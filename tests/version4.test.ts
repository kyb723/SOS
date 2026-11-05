import { describe, it, expect } from "vitest";
import {
  Availability,
  Shift,
  DemoData,
  availabilityWindows,
  validateScheduledShift,
  planMonthlyPublication,
} from "../src/lib/scheduling";
const a: Availability = {
  id: "a",
  employeeId: "alex",
  dates: ["2026-11-09"],
  start: "09:00",
  end: "18:00",
  allDay: false,
  branches: ["ST", "CSW"],
};
const s: Shift = {
  id: "s",
  employeeId: "alex",
  date: "2026-11-09",
  start: "11:00",
  end: "17:00",
  branch: "ST",
  status: "draft",
};
const data: DemoData = { version: 1, availability: [a], shifts: [s] };
describe("strict availability scheduling", () => {
  it("allows a shift fully inside one submitted interval", () =>
    expect(validateScheduledShift(s, [s], [a])).toBeNull());
  it("rejects missing availability, wrong employee and date", () => {
    expect(validateScheduledShift(s, [], [])).toMatch(/Submit availability/);
    expect(
      validateScheduledShift({ ...s, employeeId: "jamie" }, [], [a]),
    ).not.toBeNull();
    expect(
      validateScheduledShift({ ...s, date: "2026-11-10" }, [], [a]),
    ).not.toBeNull();
  });
  it("rejects disallowed branch and out-of-range start and finish", () => {
    expect(validateScheduledShift({ ...s, branch: "SOHO W" }, [], [a])).toMatch(
      /branch/,
    );
    for (const value of [{ start: "08:00" }, { end: "19:00" }])
      expect(validateScheduledShift({ ...s, ...value }, [], [a])).toMatch(
        /entire shift/,
      );
  });
  it("never mixes branches and times from different submissions", () => {
    const later = {
      ...a,
      id: "later",
      start: "18:00",
      end: "22:00",
      branches: ["SOHO W"] as const,
    };
    expect(
      validateScheduledShift(
        { ...s, branch: "SOHO W" },
        [],
        [a, { ...later, branches: [...later.branches] }],
      ),
    ).not.toBeNull();
    expect(
      validateScheduledShift(
        { ...s, end: "20:00" },
        [],
        [a, { ...a, id: "b", start: "18:00", end: "22:00" }],
      ),
    ).not.toBeNull();
  });
  it("bounds all-day submissions by explicit prototype opening hours", () => {
    expect(
      availabilityWindows("alex", s.date, [{ ...a, allDay: true }]),
    ).toEqual([
      { availabilityId: "a", branch: "ST", start: "08:00", end: "20:00" },
      { availabilityId: "a", branch: "CSW", start: "08:00", end: "20:00" },
    ]);
    expect(
      validateScheduledShift(
        { ...s, start: "07:00" },
        [],
        [{ ...a, allDay: true }],
      ),
    ).not.toBeNull();
  });
  it("enforces overlap across branches and on edits", () => {
    expect(
      validateScheduledShift({ ...s, id: "new", branch: "CSW" }, [s], [a]),
    ).toMatch(/overlapping/);
    expect(validateScheduledShift({ ...s, end: "16:00" }, [s], [a])).toBeNull();
  });
});
describe("whole-month publication planning", () => {
  it("publishes all branches and SH in only the chosen month", () => {
    const d: DemoData = {
      ...data,
      availability: [a, { ...a, id: "j", employeeId: "jamie" }],
      shifts: [
        s,
        { ...s, id: "j", employeeId: "jamie", branch: "CSW" },
        { ...s, id: "dec", date: "2026-12-01" },
      ],
      shItems: [
        {
          id: "h",
          employeeId: "sam",
          date: "2026-11-10",
          branch: "SOHO W",
          code: "SH01",
          status: "draft",
        },
      ],
    };
    const plan = planMonthlyPublication(d, "2026-11");
    expect(plan.errors).toEqual([]);
    expect(plan.count).toBe(3);
    expect(
      plan.data.shifts.filter((s) => s.status === "published"),
    ).toHaveLength(2);
    expect(plan.data.shItems?.[0].status).toBe("published");
    expect(plan.data.shifts.at(-1)?.status).toBe("draft");
    expect(d.shifts[0].status).toBe("draft");
  });
  it("blocks the whole operation for any invalid draft and returns original data", () => {
    const d = {
      ...data,
      shifts: [s, { ...s, id: "bad", branch: "SOHO W" as const }],
    };
    const plan = planMonthlyPublication(d, "2026-11");
    expect(plan.errors.length).toBeGreaterThan(0);
    expect(plan.data).toBe(d);
    expect(plan.errors.join()).toMatch(/Alex Chan.*2026-11-09/);
  });
  it("preserves legacy published items even if no longer valid, without hiding invalid drafts", () => {
    const d = {
      ...data,
      shifts: [
        { ...s, id: "old", date: "2026-11-01", status: "published" as const },
        s,
      ],
    };
    const plan = planMonthlyPublication(d, "2026-11");
    expect(plan.errors).toEqual([]);
    expect(plan.data.shifts[0]).toBe(d.shifts[0]);
  });
  it("blocks conflicting SH and shifts and keeps availability unchanged", () => {
    const d: DemoData = {
      ...data,
      shItems: [
        {
          id: "h",
          employeeId: "alex",
          date: s.date,
          branch: "CSW",
          code: "SH01",
          status: "draft",
        },
      ],
    };
    const plan = planMonthlyPublication(d, "2026-11");
    expect(plan.errors).toHaveLength(2);
    expect(plan.data.availability).toEqual([a]);
  });
});
