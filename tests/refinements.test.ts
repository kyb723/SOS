import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Availability,
  Shift,
  availabilityStatus,
  availabilityWarning,
  employeeHours,
  filterShifts,
  formatHours,
  validateAvailabilitySubmission,
} from "../src/lib/scheduling";
import { localScheduleRepository, STORAGE_KEY } from "../src/lib/storage";
const a: Availability = {
  id: "a",
  employeeId: "alex",
  dates: ["2026-11-09", "2026-11-10"],
  start: "09:00",
  end: "18:00",
  allDay: false,
  branches: ["ST", "CSW"],
};
const s: Shift = {
  id: "s",
  employeeId: "alex",
  date: "2026-11-09",
  start: "09:30",
  end: "17:00",
  branch: "ST",
  status: "published",
};
describe("availability history and status", () => {
  it("keeps unscheduled, partially scheduled and fully scheduled distinct", () => {
    expect(availabilityStatus(a, [])).toBe("Not Scheduled");
    expect(availabilityStatus(a, [s])).toBe("Partially Scheduled");
    expect(
      availabilityStatus(a, [s, { ...s, id: "s2", date: "2026-11-10" }]),
    ).toBe("Scheduled");
  });
  it("requires compatible branches and fully contained time ranges", () => {
    expect(
      availabilityStatus({ ...a, dates: [s.date] }, [
        { ...s, branch: "SOHO W" },
      ]),
    ).toBe("Not Scheduled");
    expect(
      availabilityStatus({ ...a, dates: [s.date] }, [{ ...s, start: "08:00" }]),
    ).toBe("Partially Scheduled");
    expect(
      availabilityStatus(a, [{ ...s, end: "09:00", start: "08:00" }]),
    ).toBe("Not Scheduled");
  });
  it("does not mark mixed valid and outside shifts as fully scheduled", () =>
    expect(
      availabilityStatus({ ...a, dates: [s.date] }, [
        s,
        { ...s, id: "late", start: "18:00", end: "20:00" },
      ]),
    ).toBe("Partially Scheduled"));
  it("all-day still respects branches and dates", () => {
    expect(
      availabilityStatus({ ...a, allDay: true, dates: [s.date] }, [
        { ...s, start: "06:00", end: "22:00" },
      ]),
    ).toBe("Scheduled");
    expect(
      availabilityStatus({ ...a, allDay: true }, [
        { ...s, date: "2026-12-01" },
      ]),
    ).toBe("Not Scheduled");
  });
  it("updates after edits and deletions without mutating availability", () => {
    const before = JSON.stringify(a);
    expect(availabilityStatus(a, [s])).toBe("Partially Scheduled");
    expect(availabilityStatus(a, [])).toBe("Not Scheduled");
    expect(JSON.stringify(a)).toBe(before);
  });
  it("warns for missing, outside-time and wrong-branch availability", () => {
    expect(availabilityWarning(s, [])).toMatch(/No availability/);
    expect(availabilityWarning({ ...s, start: "08:00" }, [a])).toMatch(
      /Outside/,
    );
    expect(availabilityWarning({ ...s, branch: "SOHO W" }, [a])).toMatch(
      /Outside/,
    );
    expect(availabilityWarning(s, [a])).toBeNull();
  });
  it("prevents duplicates across multi-date submissions and branch order", () => {
    expect(
      validateAvailabilitySubmission(
        { ...a, id: "new", dates: ["2026-11-10"], branches: ["CSW", "ST"] },
        [a],
      ),
    ).toMatch(/already exists/);
    expect(validateAvailabilitySubmission(a, [a])).toBeNull();
    expect(
      validateAvailabilitySubmission({ ...a, id: "new", start: "10:00" }, [a]),
    ).toMatch(/already exists/);
    expect(
      validateAvailabilitySubmission({ ...a, dates: [s.date, s.date] }, []),
    ).toMatch(/duplicate dates/);
  });
  it("all-day duplicates ignore disabled custom time values", () =>
    expect(
      validateAvailabilitySubmission(
        { ...a, id: "new", allDay: true, start: "" },
        [{ ...a, allDay: true }],
      ),
    ).toMatch(/already exists/));
});
describe("monthly scheduled hours and visibility", () => {
  const shifts = [
    s,
    {
      ...s,
      id: "draft",
      branch: "CSW" as const,
      status: "draft" as const,
      start: "18:00",
      end: "19:30",
    },
    { ...s, id: "dec", date: "2026-12-01" },
    { ...s, id: "jamie", employeeId: "jamie" },
  ];
  it("uses exact shift duration and separates published and draft hours", () => {
    expect(
      employeeHours(filterShifts(shifts, "2026-11", "All", true), "alex"),
    ).toEqual({ published: 7.5, draft: 1.5 });
    expect(formatHours(27.5)).toBe("27.5");
  });
  it("staff only count and see published shifts", () =>
    expect(
      employeeHours(filterShifts(shifts, "2026-11", "All", false), "alex"),
    ).toEqual({ published: 7.5, draft: 0 }));
  it("filters branch and month without counting availability or other staff", () => {
    expect(
      employeeHours(filterShifts(shifts, "2026-11", "CSW", true), "alex"),
    ).toEqual({ published: 0, draft: 1.5 });
    expect(
      employeeHours(filterShifts(shifts, "2026-12", "All", true), "alex"),
    ).toEqual({ published: 7.5, draft: 0 });
    expect(
      employeeHours(filterShifts(shifts, "2027-01", "All", true), "alex"),
    ).toEqual({ published: 0, draft: 0 });
  });
});
describe("localStorage backwards compatibility and persistence", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("round-trips V1 records and keeps availability after shift cancellation", () => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
    });
    localScheduleRepository.save({
      version: 1,
      shifts: [s],
      availability: [a],
    });
    expect(localScheduleRepository.load().availability).toEqual([a]);
    localScheduleRepository.save({
      ...localScheduleRepository.load(),
      shifts: [],
    });
    expect(localScheduleRepository.load().availability).toEqual([a]);
    expect(availabilityStatus(a, localScheduleRepository.load().shifts)).toBe(
      "Not Scheduled",
    );
    expect(memory.has(STORAGE_KEY)).toBe(true);
  });
  it("reports corrupt storage instead of silently overwriting it", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{broken" });
    expect(() => localScheduleRepository.load()).toThrow();
  });
});
