import { describe, expect, it } from "vitest";
import { calculate } from "../src/engine";
import { example } from "../src/examples";
import { calendar, csv, markdown, parse, serialize } from "../src/documents";
describe("portable outputs", () => {
  it("roundtrips a normalized config without result fields", () => {
    const c = example();
    expect(parse(serialize(c))).toEqual(c);
    expect(serialize(c)).not.toContain("rotation");
  });
  it("rejects malformed and oversized imports", () => {
    expect(() => parse("{")).toThrow();
    expect(() => parse("a".repeat(256001))).toThrow();
    expect(() => parse('{"version":2}')).toThrow();
  });
  it("exports four UTC calendar events, with no invitation protocol", () => {
    const c = example(),
      s = calendar(c, calculate(c).rotation!);
    expect(s.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(s).toContain("DTSTART:202610");
    expect(s).toContain("Z\r\n");
    expect(s).not.toContain("RRULE:");
    expect(s).not.toContain("METHOD:REQUEST");
    expect(s.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });
  it("folds UTF-8 lines at 75 octets and escapes event punctuation", () => {
    const c = example();
    c.title = "中文会议".repeat(15) + "; hello, there\\";
    const s = calendar(c, calculate(c).rotation!);
    s.split("\r\n").forEach((line) =>
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75),
    );
    expect(s.replaceAll("\r\n ", "")).toContain("\\; hello\\, there\\\\");
    expect(calendar(c, calculate(c).rotation!)).toBe(s);
  });
  it("quotes CSV names and neutralizes spreadsheet formula prefixes", () => {
    const c = example();
    c.people[0].name = '=HYPERLINK("bad")';
    const out = csv(c, calculate(c).rotation!);
    expect(out).toContain('"\'=HYPERLINK(""bad"")"');
    expect(out).toContain("UTC");
    expect(out).toContain("Carried points");
  });
  it("escapes Markdown cells and includes the policy and every week", () => {
    const c = example();
    c.people[0].name = "<img> | Alex";
    const out = markdown(c, calculate(c).rotation!);
    expect(out).not.toContain("<img>");
    expect(out).toContain("&lt;img&gt; \\| Alex");
    expect(out).toContain("2026-11-09");
    expect(out).toContain("8 points/hour");
  });
});
