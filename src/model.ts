export type Language = "en" | "zh";
export interface Person {
  id: string;
  name: string;
  zone: string;
  workStart: string;
  workEnd: string;
  sleepStart: string;
  sleepEnd: string;
  days: number[];
  carriedPain: number;
  budget: number;
}
export interface Config {
  version: 1;
  title: string;
  date: string;
  referenceZone: string;
  duration: number;
  occurrences: number;
  protectSleep: boolean;
  protectDays: boolean;
  people: Person[];
}
export interface LocalParts {
  date: string;
  time: string;
  minute: number;
  day: number;
  offset: number;
}
export interface PersonPain {
  id: string;
  points: number;
  sleepMinutes: number;
  outsideMinutes: number;
  offDayMinutes: number;
  start: LocalParts;
  end: LocalParts;
}
export interface Slot {
  start: number;
  end: number;
  reference: LocalParts;
  people: PersonPain[];
  totalPain: number;
  eligible: boolean;
}
export interface Plan {
  slots: Slot[];
  newPain: number[];
  totalPain: number;
  worstRatio: number;
  squaredRatios: number;
}
export interface Results {
  dates: string[];
  candidates: Slot[];
  fixed: Plan | null;
  rotation: Plan | null;
  unavailableDates: string[];
}
export const MAX_BYTES = 256_000;
export class InputError extends Error {
  constructor(
    public code: string,
    public detail = "",
  ) {
    super(detail || code);
  }
}
