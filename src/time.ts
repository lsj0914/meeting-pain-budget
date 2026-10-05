import type { LocalParts } from "./model";
const formatters = new Map<string, Intl.DateTimeFormat>();
export const STEP = 15 * 60_000;
export function localParts(instant: number, zone: string): LocalParts {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    if (formatters.size > 40) formatters.clear();
    formatters.set(zone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year),
    m = Number(parts.month),
    d = Number(parts.day),
    h = Number(parts.hour),
    min = Number(parts.minute);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    time: `${parts.hour}:${parts.minute}`,
    minute: h * 60 + min,
    day: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    offset: Math.round((Date.UTC(y, m - 1, d, h, min) - instant) / 60_000),
  };
}
export function dayStarts(date: string, zone: string): number[] {
  const midnight = Date.parse(`${date}T00:00:00Z`),
    starts: number[] = [];
  for (
    let t = midnight - 24 * 3600_000;
    t < midnight + 48 * 3600_000;
    t += STEP
  ) {
    const p = localParts(t, zone);
    if (p.date === date && p.minute % 15 === 0) starts.push(t);
  }
  return starts;
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400_000)
    .toISOString()
    .slice(0, 10);
}
export function clockMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}
export function inside(minute: number, start: string, end: string): boolean {
  const a = clockMinutes(start),
    b = clockMinutes(end);
  return a < b ? minute >= a && minute < b : minute >= a || minute < b;
}
export function offsetLabel(offset: number): string {
  return `UTC${offset < 0 ? "−" : "+"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
}
