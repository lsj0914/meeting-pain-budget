import type { Config, Person } from "./model";
const person = (id: string, name: string, zone: string): Person => ({
  id,
  name,
  zone,
  workStart: "09:00",
  workEnd: "17:00",
  sleepStart: "22:00",
  sleepEnd: "07:00",
  days: [1, 2, 3, 4, 5],
  carriedPain: 0,
  budget: 8,
});
export function example(kind = "two"): Config {
  const c: Config = {
    version: 1,
    title: "Across the clock",
    date: "2026-10-19",
    referenceZone: "America/New_York",
    duration: 60,
    occurrences: 4,
    protectSleep: true,
    protectDays: true,
    people: [
      person("ny", "Alex", "America/New_York"),
      person("sh", "Lin", "Asia/Shanghai"),
    ],
  };
  if (kind === "three") {
    c.title = "Three cities, one team";
    c.people.push(person("ldn", "Sam", "Europe/London"));
    c.protectSleep = false;
  }
  if (kind === "night") {
    c.title = "The night-shift handover";
    c.referenceZone = "UTC";
    c.people = [
      person("a", "Night crew", "UTC"),
      person("b", "Early crew", "UTC"),
    ];
    c.people[0].workStart = "22:00";
    c.people[0].workEnd = "06:00";
    c.people[0].sleepStart = "08:00";
    c.people[0].sleepEnd = "15:00";
    c.people[1].workStart = "06:00";
    c.people[1].workEnd = "14:00";
    c.people[1].sleepStart = "20:00";
    c.people[1].sleepEnd = "04:00";
  }
  return c;
}
