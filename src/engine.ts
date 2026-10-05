import {
  InputError,
  MAX_BYTES,
  type Config,
  type Results,
  type Slot,
  type Plan,
  type Person,
  type LocalParts,
} from "./model";
import { addDays, dayStarts, inside, localParts, STEP } from "./time";
const fail = (code: string, detail = ""): never => {
  throw new InputError(code, detail);
};
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail("shape");
const text = (v: unknown, max: number): string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max
    ? v.trim()
    : fail("text");
const num = (v: unknown, min: number, max: number): number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : fail("number");
const zone = (v: unknown): string => {
  const z = text(v, 100);
  try {
    new Intl.DateTimeFormat("en", { timeZone: z }).format(0);
  } catch {
    fail("zone", z);
  }
  return z;
};
const clock = (v: unknown): string => {
  if (typeof v !== "string" || !/^([01]\d|2[0-3]):(00|15|30|45)$/.test(v))
    fail("clock");
  return v as string;
};
export function validateConfig(input: unknown): Config {
  const c = record(input);
  if (c.version !== 1) fail("version");
  const date = text(c.date, 10);
  if (
    !/^(20\d\d)-\d\d-\d\d$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00Z`)) ||
    addDays(date, 0) !== date
  )
    fail("date");
  const duration = num(c.duration, 15, 180),
    occurrences = num(c.occurrences, 1, 8);
  if (
    duration % 15 ||
    !Number.isInteger(occurrences) ||
    addDays(date, (occurrences - 1) * 7).slice(0, 2) !== "20"
  )
    fail("number");
  if (typeof c.protectSleep !== "boolean" || typeof c.protectDays !== "boolean")
    fail("shape");
  if (!Array.isArray(c.people) || c.people.length < 2 || c.people.length > 12)
    fail("people");
  const ids = new Set<string>();
  const people: Person[] = (c.people as unknown[]).map((value) => {
    const p = record(value),
      id = text(p.id, 80),
      name = text(p.name, 80);
    if (ids.has(id)) fail("duplicate");
    ids.add(id);
    const workStart = clock(p.workStart),
      workEnd = clock(p.workEnd),
      sleepStart = clock(p.sleepStart),
      sleepEnd = clock(p.sleepEnd);
    if (workStart === workEnd || sleepStart === sleepEnd) fail("window", name);
    for (let minute = 0; minute < 1440; minute += 15)
      if (
        inside(minute, workStart, workEnd) &&
        inside(minute, sleepStart, sleepEnd)
      )
        fail("overlap", name);
    if (
      !Array.isArray(p.days) ||
      p.days.length === 0 ||
      p.days.some(
        (d) => typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6,
      )
    )
      fail("days", name);
    return {
      id,
      name,
      zone: zone(p.zone),
      workStart,
      workEnd,
      sleepStart,
      sleepEnd,
      days: [...new Set(p.days as number[])].sort(),
      carriedPain: num(p.carriedPain, 0, 10000),
      budget: num(p.budget, 0, 10000),
    };
  });
  const result: Config = {
    version: 1,
    title: text(c.title, 120),
    date,
    referenceZone: zone(c.referenceZone),
    duration,
    occurrences,
    protectSleep: c.protectSleep as boolean,
    protectDays: c.protectDays as boolean,
    people,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_BYTES)
    fail("size");
  return result;
}
type LocalReader = (t: number, z: string) => LocalParts;
function scoreSlot(config: Config, start: number, read: LocalReader): Slot {
  const end = start + config.duration * 60_000;
  const people = config.people.map((p) => {
    let sleepMinutes = 0,
      outsideMinutes = 0,
      offDayMinutes = 0;
    for (let t = start; t < end; t += STEP) {
      const l = read(t, p.zone);
      if (inside(l.minute, p.sleepStart, p.sleepEnd)) sleepMinutes += 15;
      else if (!inside(l.minute, p.workStart, p.workEnd)) outsideMinutes += 15;
      if (!p.days.includes(l.day)) offDayMinutes += 15;
    }
    return {
      id: p.id,
      points: (sleepMinutes * 8 + outsideMinutes * 2 + offDayMinutes * 4) / 60,
      sleepMinutes,
      outsideMinutes,
      offDayMinutes,
      start: read(start, p.zone),
      end: read(end, p.zone),
    };
  });
  return {
    start,
    end,
    reference: read(start, config.referenceZone),
    people,
    totalPain: people.reduce((s, p) => s + p.points, 0),
    eligible: people.every(
      (p) =>
        (!config.protectSleep || p.sleepMinutes === 0) &&
        (!config.protectDays || p.offDayMinutes === 0),
    ),
  };
}
export function evaluateSlot(config: Config, start: number): Slot {
  return scoreSlot(config, start, localParts);
}
export function summarize(config: Config, slots: Slot[]): Plan {
  const newPain = config.people.map((_, i) =>
    slots.reduce((s, slot) => s + slot.people[i].points, 0),
  );
  const ratios = newPain.map(
    (p, i) =>
      (p + config.people[i].carriedPain) / Math.max(config.people[i].budget, 1),
  );
  return {
    slots,
    newPain,
    totalPain: newPain.reduce((s, p) => s + p, 0),
    worstRatio: Math.max(...ratios),
    squaredRatios: ratios.reduce((s, r) => s + r * r, 0),
  };
}
export function comparePlans(a: Plan, b: Plan): number {
  return (
    a.worstRatio - b.worstRatio ||
    a.totalPain - b.totalPain ||
    a.squaredRatios - b.squaredRatios ||
    a.slots.reduce(
      (s, slot, i) => s + (slot.start - (b.slots[i]?.start ?? slot.start)),
      0,
    )
  );
}
function frontier(slots: Slot[]): Slot[] {
  const unique = new Map<string, Slot>();
  slots.forEach((s) => {
    const k = s.people.map((p) => p.points).join(",");
    if (!unique.has(k)) unique.set(k, s);
  });
  const values = [...unique.values()];
  return values.filter(
    (s) =>
      !values.some(
        (other) =>
          other !== s &&
          other.people.every((p, i) => p.points <= s.people[i].points) &&
          other.people.some((p, i) => p.points < s.people[i].points),
      ),
  );
}
export function calculate(input: Config): Results {
  const c = validateConfig(input),
    dates = Array.from({ length: c.occurrences }, (_, i) =>
      addDays(c.date, i * 7),
    );
  const cache = new Map<string, LocalParts>();
  const read: LocalReader = (t, z) => {
    const k = `${z}:${t}`;
    let p = cache.get(k);
    if (!p) {
      p = localParts(t, z);
      cache.set(k, p);
    }
    return p;
  };
  const days = dates.map((d) =>
    dayStarts(d, c.referenceZone)
      .map((t) => scoreSlot(c, t, read))
      .filter((s) => s.eligible),
  );
  const candidates = [...days[0]].sort((a, b) =>
    comparePlans(summarize(c, [a]), summarize(c, [b])),
  );
  const unavailableDates = dates.filter((_, i) => days[i].length === 0);
  if (unavailableDates.length)
    return { dates, candidates, fixed: null, rotation: null, unavailableDates };
  let fixed: Plan | null = null;
  for (const time of new Set(days[0].map((s) => s.reference.time))) {
    const options = days.map((slots) =>
      slots.filter((s) => s.reference.time === time),
    );
    if (options.some((slots) => !slots.length)) continue;
    // Repeated wall times on a fall-back day are distinct feasible instants.
    let partial: Plan[] = [summarize(c, [])];
    options.forEach((slots) => {
      partial = partial
        .flatMap((p) => slots.map((s) => summarize(c, [...p.slots, s])))
        .sort(comparePlans)
        .slice(0, 128);
    });
    if (!fixed || comparePlans(partial[0], fixed) < 0) fixed = partial[0];
  }
  let beam: Plan[] = [summarize(c, [])];
  days.forEach((slots) => {
    const states = new Map<string, Plan>(),
      choices = frontier(slots);
    for (const p of beam)
      for (const slot of choices) {
        const next = summarize(c, [...p.slots, slot]),
          key = next.newPain.join(",");
        const old = states.get(key);
        if (!old || comparePlans(next, old) < 0) states.set(key, next);
      }
    beam = [...states.values()].sort(comparePlans).slice(0, 128);
  });
  let rotation = beam[0];
  if (fixed && comparePlans(fixed, rotation) < 0) rotation = fixed;
  return { dates, candidates, fixed, rotation, unavailableDates };
}
