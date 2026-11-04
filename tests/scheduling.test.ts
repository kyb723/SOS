import { describe, expect, it } from "vitest";
import {
  Availability,
  makeSeed,
  Shift,
  shiftsOverlap,
  validateAvailability,
  validateShift,
} from "../src/lib/scheduling";
const shift: Shift = {
  id: "one",
  employeeId: "alex",
  date: "2026-11-05",
  start: "08:00",
  end: "16:00",
  branch: "ST",
  status: "draft",
};
const available: Availability = {
  id: "one",
  employeeId: "alex",
  dates: ["2026-11-05"],
  start: "08:00",
  end: "18:00",
  allDay: false,
  branches: ["ST", "CSW"],
};
describe("shift scheduling", () => {
  it("prevents overlaps across branches including drafts", () =>
    expect(
      validateShift({ ...shift, id: "two", branch: "CSW", start: "15:00" }, [
        shift,
      ]),
    ).toMatch(/overlapping/));
  it("allows adjacent shifts", () =>
    expect(
      validateShift({ ...shift, id: "two", start: "16:00", end: "19:00" }, [
        shift,
      ]),
    ).toBeNull());
  it("detects identical and contained intervals", () => {
    expect(
      shiftsOverlap(shift, { ...shift, start: "09:00", end: "10:00" }),
    ).toBe(true);
    expect(shiftsOverlap(shift, { ...shift })).toBe(true);
  });
  it("ignores other employees and dates", () => {
    expect(shiftsOverlap(shift, { ...shift, employeeId: "jamie" })).toBe(false);
    expect(shiftsOverlap(shift, { ...shift, date: "2026-11-06" })).toBe(false);
  });
  it("allows edits without self-conflict", () =>
    expect(validateShift(shift, [shift])).toBeNull());
  it("rejects reversed, equal, overnight and malformed times", () => {
    for (const [start, end] of [
      ["16:00", "08:00"],
      ["08:00", "08:00"],
      ["22:00", "02:00"],
      ["25:00", "26:00"],
    ])
      expect(validateShift({ ...shift, start, end }, [])).not.toBeNull();
  });
  it("rejects impossible dates and unknown staff", () => {
    expect(validateShift({ ...shift, date: "2026-02-30" }, [])).not.toBeNull();
    expect(
      validateShift({ ...shift, employeeId: "unknown" }, []),
    ).not.toBeNull();
  });
  it("generates valid nonoverlapping data for six employees", () => {
    const seed = makeSeed(new Date(2026, 10, 1));
    expect(new Set(seed.shifts.map((s) => s.employeeId)).size).toBe(6);
    expect(seed.shifts.length).toBeGreaterThan(0);
    expect(
      seed.shifts.every((s) => validateShift(s, seed.shifts) === null),
    ).toBe(true);
    expect(
      seed.availability.every((a) => validateAvailability(a) === null),
    ).toBe(true);
  });
});
describe("availability", () => {
  it("accepts multiple dates and branches", () =>
    expect(
      validateAvailability({
        ...available,
        dates: [...available.dates, "2026-11-06"],
      }),
    ).toBeNull());
  it("requires dates and branches", () => {
    expect(validateAvailability({ ...available, dates: [] })).toMatch(/date/);
    expect(validateAvailability({ ...available, branches: [] })).toMatch(
      /branch/,
    );
  });
  it("rejects malformed and impossible dates", () => {
    expect(
      validateAvailability({ ...available, dates: ["bad"] }),
    ).not.toBeNull();
    expect(
      validateAvailability({ ...available, dates: ["2026-02-30"] }),
    ).not.toBeNull();
  });
  it("requires ordered times unless all-day", () => {
    expect(
      validateAvailability({ ...available, start: "20:00" }),
    ).not.toBeNull();
    expect(validateAvailability({ ...available, end: "08:00" })).not.toBeNull();
    expect(validateAvailability({ ...available, start: "bad" })).not.toBeNull();
    expect(
      validateAvailability({ ...available, allDay: true, start: "", end: "" }),
    ).toBeNull();
  });
});
