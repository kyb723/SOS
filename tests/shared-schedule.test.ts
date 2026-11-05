import { describe, it, expect } from "vitest";
import { scheduleChanges } from "../src/lib/shared-schedule";
import {
  validateScheduledShift,
  planMonthlyPublication,
  validateAvailabilitySubmission,
} from "../src/lib/scheduling";
import type {
  DemoData,
  Employee,
  Availability,
  Shift,
} from "../src/lib/scheduling";
const alex = "20000000-0000-4000-8000-000000000002";
const jamie = "20000000-0000-4000-8000-000000000003";
const team: Employee[] = [
  { id: alex, name: "Alex Test", role: "Staff", employmentType: "full-time" },
  { id: jamie, name: "Jamie Test", role: "Staff", employmentType: "part-time" },
];
const a: Availability = {
  id: "a",
  employeeId: alex,
  dates: ["2026-11-10"],
  start: "09:00",
  end: "18:00",
  allDay: false,
  branches: ["ST", "CSW"],
};
const shift: Shift = {
  id: "s",
  employeeId: alex,
  date: "2026-11-10",
  start: "11:00",
  end: "17:00",
  branch: "ST",
  status: "draft",
};
const before: DemoData = {
  version: 1,
  availability: [a],
  shifts: [],
  shItems: [],
};
describe("shared schedule changes and dynamic teams", () => {
  it("validates real Auth UUID employees without demo identities", () => {
    expect(validateScheduledShift(shift, [shift], [a], [], team)).toBeNull();
    expect(validateAvailabilitySubmission(a, [a], team)).toBeNull();
    expect(
      planMonthlyPublication({ ...before, shifts: [shift] }, "2026-11", team)
        .errors,
    ).toEqual([]);
  });
  it("allows staff-owned availability edits and rejects another profile ID", () => {
    expect(
      scheduleChanges(
        before,
        { ...before, availability: [{ ...a, start: "10:00" }] },
        { id: alex, role: "STAFF" },
      ),
    ).toHaveLength(1);
    expect(() =>
      scheduleChanges(
        before,
        { ...before, availability: [{ ...a, start: "10:00" }] },
        { id: jamie, role: "STAFF" },
      ),
    ).toThrow(/Only the owner/);
  });
  it("does not permit managers to impersonate another employee", () =>
    expect(() =>
      scheduleChanges(
        before,
        { ...before, availability: [] },
        { id: jamie, role: "MANAGER" },
      ),
    ).toThrow(/Only the owner/));
  it("rejects staff shift changes and permits manager changes", () => {
    expect(() =>
      scheduleChanges(
        before,
        { ...before, shifts: [shift] },
        { id: alex, role: "STAFF" },
      ),
    ).toThrow(/Manager/);
    expect(
      scheduleChanges(
        before,
        { ...before, shifts: [shift] },
        { id: jamie, role: "MANAGER" },
      ),
    ).toEqual([{ kind: "shift", action: "upsert", record: shift }]);
  });
  it("does not delete availability when a working shift is removed", () => {
    const changes = scheduleChanges({ ...before, shifts: [shift] }, before, {
      id: jamie,
      role: "MANAGER",
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("shift");
  });
});

describe("canonical shared comparisons", () => {
  it("ignores harmless branch/date ordering differences instead of attempting to edit a colleague", () => {
    const after = {
      ...before,
      availability: [{ ...a, branches: ["CSW", "ST"] as const }],
    };
    expect(
      scheduleChanges(
        before,
        {
          ...after,
          availability: after.availability.map((a) => ({
            ...a,
            branches: [...a.branches],
          })),
        },
        { id: jamie, role: "STAFF" },
      ),
    ).toEqual([]);
  });
});
