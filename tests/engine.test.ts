import { describe, expect, it } from "vitest";
import { localParts, dayStarts, inside, addDays } from "../src/time";
import { validateConfig, evaluateSlot, calculate } from "../src/engine";
import type { Config, Person } from "../src/model";

const person = (id: string, zone = "UTC"): Person => ({
  id,
  name: id,
  zone,
  workStart: "09:00",
  workEnd: "17:00",
  sleepStart: "22:00",
  sleepEnd: "07:00",
  days: [1, 2, 3, 4, 5],
  carriedPain: 0,
  budget: 8,
});
const config = (): Config => ({
  version: 1,
  title: "Team sync",
  date: "2026-10-19",
  referenceZone: "America/New_York",
  duration: 60,
  occurrences: 4,
  protectSleep: true,
  protectDays: true,
  people: [
    person("New York", "America/New_York"),
    person("Shanghai", "Asia/Shanghai"),
  ],
});

describe("actual local dates and DST instants", () => {
  it("keeps both copies of New York 01:30 with distinct offsets", () => {
    expect(
      localParts(Date.parse("2026-11-01T05:30Z"), "America/New_York"),
    ).toMatchObject({ date: "2026-11-01", time: "01:30", offset: -240 });
    expect(
      localParts(Date.parse("2026-11-01T06:30Z"), "America/New_York"),
    ).toMatchObject({ date: "2026-11-01", time: "01:30", offset: -300 });
  });
  it("has 92 starts on a 23-hour spring day and 100 on a 25-hour fall day", () => {
    expect(dayStarts("2026-03-08", "America/New_York")).toHaveLength(92);
    expect(dayStarts("2026-11-01", "America/New_York")).toHaveLength(100);
  });
  it("omits nonexistent spring-forward 02:30", () => {
    expect(
      dayStarts("2026-03-08", "America/New_York").some(
        (t) => localParts(t, "America/New_York").time === "02:30",
      ),
    ).toBe(false);
  });
  it("handles Kathmandu quarter-hour offsets and Tokyo next-day dates", () => {
    expect(
      localParts(Date.parse("2026-10-19T00:00Z"), "Asia/Kathmandu"),
    ).toMatchObject({ time: "05:45", offset: 345 });
    expect(
      localParts(Date.parse("2026-10-19T21:00Z"), "Asia/Tokyo"),
    ).toMatchObject({ date: "2026-10-20", time: "06:00" });
  });
  it("handles Lord Howe’s half-hour DST change", () => {
    expect(dayStarts("2026-10-04", "Australia/Lord_Howe")).toHaveLength(94);
    expect(
      localParts(Date.parse("2026-10-03T15:30Z"), "Australia/Lord_Howe"),
    ).toMatchObject({ time: "02:30", offset: 660 });
  });
  it("adds calendar weeks without treating them as timezone offsets", () =>
    expect(addDays("2026-10-26", 7)).toBe("2026-11-02"));
  it("handles overnight windows with exclusive ends", () => {
    expect(inside(23 * 60, "22:00", "07:00")).toBe(true);
    expect(inside(6 * 60 + 45, "22:00", "07:00")).toBe(true);
    expect(inside(7 * 60, "22:00", "07:00")).toBe(false);
    expect(inside(12 * 60, "22:00", "07:00")).toBe(false);
  });
});

describe("full-duration inconvenience policy", () => {
  it("charges 30 sleep minutes plus 30 waking-outside minutes as 5 points", () => {
    const c = config();
    c.people = [person("A"), person("B")];
    c.protectSleep = false;
    const p = evaluateSlot(c, Date.parse("2026-10-19T06:30Z")).people[0];
    expect(p.sleepMinutes).toBe(30);
    expect(p.outsideMinutes).toBe(30);
    expect(p.points).toBe(5);
  });
  it("includes the final quarter-hour beyond the comfortable window", () => {
    const c = config();
    c.people = [person("A"), person("B")];
    expect(
      evaluateSlot(c, Date.parse("2026-10-19T16:30Z")).people[0].points,
    ).toBe(1);
  });
  it("charges the portion after Friday midnight as a day-off penalty", () => {
    const c = config();
    c.people = [person("A"), person("B")];
    c.protectSleep = false;
    c.protectDays = false;
    const p = evaluateSlot(c, Date.parse("2026-10-23T23:30Z")).people[0];
    expect(p.offDayMinutes).toBe(30);
    expect(p.points).toBe(10);
  });
  it("protects any sleep overlap, including a meeting that begins awake", () => {
    const c = config();
    c.people = [person("A"), person("B")];
    expect(evaluateSlot(c, Date.parse("2026-10-19T21:30Z")).eligible).toBe(
      false,
    );
    expect(evaluateSlot(c, Date.parse("2026-10-19T21:00Z")).eligible).toBe(
      true,
    );
  });
  it("scores real elapsed time through fall-back without double-counting a wall clock", () => {
    const c = config();
    c.people = [
      person("A", "America/New_York"),
      person("B", "America/New_York"),
    ];
    c.protectSleep = false;
    c.protectDays = false;
    const p = evaluateSlot(c, Date.parse("2026-11-01T05:30Z")).people[0];
    expect(p.start.time).toBe("01:30");
    expect(p.end.time).toBe("01:30");
    expect(p.sleepMinutes).toBe(60);
    expect(p.points).toBe(12);
  });
});

describe("series fairness and constraints", () => {
  it("shares inconvenience across two equal budgets instead of always selecting one city", () => {
    const r = calculate(config());
    expect(r.rotation).not.toBeNull();
    expect(r.fixed).not.toBeNull();
    expect(r.rotation!.newPain).toEqual([4, 4]);
    expect(r.rotation!.worstRatio).toBe(0.5);
    expect(r.rotation!.worstRatio).toBeLessThan(r.fixed!.worstRatio);
    expect(r.rotation!.slots.every((s) => s.eligible)).toBe(true);
  });
  it("honors carried burden by avoiding further pain for the already affected person", () => {
    const c = config();
    c.occurrences = 2;
    c.people[0].carriedPain = 6;
    expect(calculate(c).rotation!.newPain).toEqual([0, 4]);
  });
  it("uses each occurrence’s timezone rules across the November DST boundary", () => {
    const r = calculate(config());
    expect(r.dates).toEqual([
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
    ]);
    const offsets = r.rotation!.slots.map((s) => s.people[0].start.offset);
    expect(offsets).toEqual([-240, -240, -300, -300]);
  });
  it("returns no plan rather than silently scheduling on protected days off", () => {
    const c = config();
    c.date = "2026-10-24";
    const r = calculate(c);
    expect(r.rotation).toBeNull();
    expect(r.unavailableDates).toEqual([
      "2026-10-24",
      "2026-10-31",
      "2026-11-07",
      "2026-11-14",
    ]);
  });
  it("never returns a rotation worse than its feasible fixed comparison", () => {
    const c = config();
    c.people.push(person("London", "Europe/London"));
    c.protectSleep = false;
    const r = calculate(c);
    expect(r.rotation!.worstRatio).toBeLessThanOrEqual(r.fixed!.worstRatio);
  });
  it("allows night-shift comfortable hours without assuming a daytime job", () => {
    const c = config();
    c.people = [person("A"), person("B")];
    c.people.forEach((p) => {
      p.workStart = "22:00";
      p.workEnd = "06:00";
      p.sleepStart = "08:00";
      p.sleepEnd = "15:00";
    });
    expect(evaluateSlot(c, Date.parse("2026-10-19T23:00Z")).totalPain).toBe(0);
  });
});

describe("strict configuration boundaries", () => {
  it("returns a defensive normalized copy", () => {
    const c = config();
    const v = validateConfig(c);
    v.people[0].name = "Changed";
    expect(c.people[0].name).toBe("New York");
  });
  it.each([
    [
      "unknown zone",
      (c: Config) => {
        c.people[0].zone = "Mars/Olympus";
      },
    ],
    [
      "invalid date",
      (c: Config) => {
        c.date = "2026-02-30";
      },
    ],
    [
      "empty name",
      (c: Config) => {
        c.people[0].name = "";
      },
    ],
    [
      "zero duration",
      (c: Config) => {
        c.duration = 0;
      },
    ],
    [
      "off-grid duration",
      (c: Config) => {
        c.duration = 17;
      },
    ],
    [
      "duplicate id",
      (c: Config) => {
        c.people[1].id = c.people[0].id;
      },
    ],
    [
      "missing weekdays",
      (c: Config) => {
        c.people[0].days = [];
      },
    ],
    [
      "bad weekday",
      (c: Config) => {
        c.people[0].days = [7];
      },
    ],
    [
      "overlapping sleep and work",
      (c: Config) => {
        c.people[0].workStart = "06:00";
      },
    ],
    [
      "equal window endpoints",
      (c: Config) => {
        c.people[0].workEnd = "09:00";
      },
    ],
    [
      "invalid clock",
      (c: Config) => {
        c.people[0].workStart = "25:00";
      },
    ],
    [
      "NaN budget",
      (c: Config) => {
        c.people[0].budget = NaN;
      },
    ],
    [
      "negative history",
      (c: Config) => {
        c.people[0].carriedPain = -1;
      },
    ],
    [
      "too many occurrences",
      (c: Config) => {
        c.occurrences = 9;
      },
    ],
    [
      "too few people",
      (c: Config) => {
        c.people.pop();
      },
    ],
  ])("rejects %s", (_, mutate) => {
    const c = config();
    mutate(c);
    expect(() => validateConfig(c)).toThrow();
  });
  it.each([null, {}, [], { version: 2 }])(
    "rejects malformed shape %j",
    (input) => expect(() => validateConfig(input)).toThrow(),
  );
});
