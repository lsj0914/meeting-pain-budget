import { MAX_BYTES, InputError, type Config, type Plan } from "./model";
import { validateConfig } from "./engine";
import { offsetLabel } from "./time";
const md = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]/g, " ");
export function markdown(c: Config, p: Plan): string {
  const lines = [
    `# ${md(c.title)}`,
    "",
    `Reference zone: ${c.referenceZone}. Duration: ${c.duration} minutes. Weekly occurrences: ${p.slots.length}.`,
    "",
    "## Schedule",
    "",
    `| Week | ${c.people.map((x) => md(x.name)).join(" | ")} |`,
    "| --- | " + c.people.map(() => "---").join(" | ") + " |",
  ];
  p.slots.forEach((s, i) =>
    lines.push(
      `| ${i + 1} | ${s.people.map((x) => `${x.start.date} ${x.start.time} ${offsetLabel(x.start.offset)} → ${x.end.date} ${x.end.time} ${offsetLabel(x.end.offset)} (${x.points} pt)`).join(" | ")} |`,
    ),
  );
  lines.push(
    "",
    "## Budget ledger",
    "",
    "| Person | Carried | New | Total | Budget |",
    "| --- | --- | --- | --- | --- |",
  );
  c.people.forEach((x, i) =>
    lines.push(
      `| ${md(x.name)} | ${x.carriedPain} | ${p.newPain[i]} | ${x.carriedPain + p.newPain[i]} | ${x.budget} |`,
    ),
  );
  lines.push(
    "",
    "## Assumptions",
    "",
    "Comfortable hours: 0 points/hour. Awake outside: 2 points/hour. Sleep: 8 points/hour. Days off add 4 points/hour. All elapsed minutes are counted in 15-minute segments.",
    `Protect sleep: ${c.protectSleep}. Protect days off: ${c.protectDays}.`,
    "Budgets are preferences, not promises. Fairness minimizes the largest (carried + new) / max(budget, 1) ratio, then total new points, then squared ratios. Rotation uses a bounded heuristic and may not be globally optimal. Calendar exports contain explicit UTC events rather than a fixed recurrence rule.",
  );
  return lines.join("\n") + "\n";
}
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export function csv(c: Config, p: Plan): string {
  const rows: (string | number)[][] = [
    [
      "Week",
      "Person",
      "Zone",
      "Start date",
      "Start time",
      "Start UTC offset",
      "End date",
      "End time",
      "End UTC offset",
      "Meeting points",
      "Sleep minutes",
      "Outside minutes",
      "Day-off minutes",
    ],
  ];
  p.slots.forEach((s, i) =>
    s.people.forEach((x, j) =>
      rows.push([
        i + 1,
        c.people[j].name,
        c.people[j].zone,
        x.start.date,
        x.start.time,
        offsetLabel(x.start.offset),
        x.end.date,
        x.end.time,
        offsetLabel(x.end.offset),
        x.points,
        x.sleepMinutes,
        x.outsideMinutes,
        x.offDayMinutes,
      ]),
    ),
  );
  rows.push(
    [],
    [
      "Person",
      "Carried points",
      "New points",
      "Total points",
      "Budget",
      "Over budget",
    ],
  );
  c.people.forEach((x, i) =>
    rows.push([
      x.name,
      x.carriedPain,
      p.newPain[i],
      x.carriedPain + p.newPain[i],
      x.budget,
      x.carriedPain + p.newPain[i] > x.budget ? "Yes" : "No",
    ]),
  );
  return (
    "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
const icsText = (v: string) =>
  v
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n")
    .replaceAll("\r", "\\n");
const stamp = (t: number) =>
  new Date(t)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(".000", "");
function fold(line: string): string {
  const lines: string[] = [];
  let part = "",
    bytes = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    if (bytes + n > 75) {
      lines.push(part);
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += n;
  }
  lines.push(part);
  return lines.join("\r\n");
}
function hash(v: string): string {
  let h = 2166136261;
  for (const char of v) {
    h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  }
  return (h >>> 0).toString(16);
}
export function calendar(c: Config, p: Plan): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meeting Pain Budget//Local Planner 1.0//EN",
    "CALSCALE:GREGORIAN",
  ];
  const identity = hash(serialize(c));
  p.slots.forEach((s, i) => {
    const description = s.people
      .map(
        (x, j) =>
          `${c.people[j].name}: ${x.start.date} ${x.start.time} ${offsetLabel(x.start.offset)} to ${x.end.date} ${x.end.time} ${offsetLabel(x.end.offset)}; ${x.points} points`,
      )
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${identity}-${s.start}-${i}@meeting-pain-budget.local`,
      `DTSTAMP:${stamp(p.slots[0].start)}`,
      `DTSTART:${stamp(s.start)}`,
      `DTEND:${stamp(s.end)}`,
      `SUMMARY:${icsText(c.title)}`,
      `DESCRIPTION:${icsText(description)}`,
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function serialize(c: Config): string {
  return JSON.stringify(validateConfig(c));
}
export function parse(raw: string): Config {
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    throw new InputError("size");
  return validateConfig(JSON.parse(raw));
}
