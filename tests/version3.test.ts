import { describe, it, expect, vi, afterEach } from "vitest";
import {
  calendarDays,
  dateKey,
  toggleDate,
  weekDays,
  validateHoliday,
  validateShift,
  filterHolidays,
  employeeHours,
  Availability,
  Shift,
  StatutoryHoliday,
  validateAvailabilitySubmission,
} from "../src/lib/scheduling";
import { SH_CODES } from "../src/lib/rota-config";
import { localScheduleRepository } from "../src/lib/storage";
const a: Availability = {
  id: "a",
  employeeId: "alex",
  dates: ["2026-11-03", "2026-11-05"],
  start: "09:00",
  end: "18:00",
  allDay: false,
  branches: ["ST", "CSW"],
};
const h: StatutoryHoliday = {
  id: "h",
  employeeId: "alex",
  date: "2026-11-09",
  branch: "ST",
  code: "SH01",
  status: "draft",
};
const s: Shift = {
  id: "s",
  employeeId: "alex",
  date: "2026-11-09",
  branch: "CSW",
  start: "09:00",
  end: "17:00",
  status: "published",
};
describe("calendar and multi-date submissions", () => {
  it("selects nonconsecutive dates, toggles off and never duplicates", () => {
    let dates: string[] = [];
    for (const d of ["2026-11-03", "2026-11-05", "2026-11-08", "2026-11-12"])
      dates = toggleDate(dates, d);
    expect(dates).toHaveLength(4);
    dates = toggleDate(dates, "2026-11-05");
    expect(dates).not.toContain("2026-11-05");
    expect(new Set(dates).size).toBe(dates.length);
  });
  it("uses Monday-first 42-cell grids including adjacent month dates", () => {
    const days = calendarDays(new Date(2026, 10, 1));
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(days.at(-1)?.getDay()).toBe(0);
    expect(dateKey(days[0])).toBe("2026-10-26");
  });
  it("keeps multi-month selections independent of month navigation", () => {
    const dates = toggleDate(a.dates, "2026-12-01");
    calendarDays(new Date(2026, 11, 1));
    calendarDays(new Date(2026, 10, 1));
    expect(dates).toEqual(["2026-11-03", "2026-11-05", "2026-12-01"]);
    expect(validateAvailabilitySubmission({ ...a, dates }, [])).toBeNull();
  });
  it("blocks any duplicate employee-date regardless of changed preferences", () => {
    expect(
      validateAvailabilitySubmission(
        { ...a, id: "b", start: "10:00", branches: ["SOHO W"] },
        [a],
      ),
    ).toMatch(/already exists/);
    expect(validateAvailabilitySubmission(a, [a])).toBeNull();
    expect(
      validateAvailabilitySubmission({ ...a, employeeId: "jamie" }, [a]),
    ).toBeNull();
  });
  it("renders seven consecutive days across year boundaries", () => {
    const days = weekDays(new Date(2027, 0, 1));
    expect(days).toHaveLength(7);
    expect(dateKey(days[0])).toBe("2026-12-28");
    expect(dateKey(days[6])).toBe("2027-01-03");
  });
});
describe("SH records", () => {
  it("offers 12 initial configurable codes and supports expansion", () => {
    expect(SH_CODES).toHaveLength(12);
    expect(SH_CODES.at(-1)).toBe("SH12");
    expect(
      validateHoliday({ ...h, code: "SH13" }, [], [], [...SH_CODES, "SH13"]),
    ).toBeNull();
  });
  it("validates creation and edits without self-conflict", () => {
    expect(validateHoliday(h, [], [])).toBeNull();
    expect(validateHoliday({ ...h, code: "SH02" }, [h], [])).toBeNull();
  });
  it("prevents duplicate all-day items and work conflicts in both directions across branches", () => {
    expect(validateHoliday({ ...h, id: "new" }, [h], [])).toMatch(
      /already exists/,
    );
    expect(validateHoliday(h, [], [s])).toMatch(/working shift/);
    expect(validateShift(s, [], [h])).toMatch(/SH item/);
  });
  it("restricts to configured full-time employees, valid codes and dates", () => {
    expect(validateHoliday({ ...h, employeeId: "riley" }, [], [])).toMatch(
      /full-time/,
    );
    expect(validateHoliday({ ...h, code: "BAD" }, [], [])).not.toBeNull();
    expect(
      validateHoliday({ ...h, date: "2026-02-30" }, [], []),
    ).not.toBeNull();
  });
  it("hides drafts from staff and respects branch filters", () => {
    const live = {
      ...h,
      id: "live",
      status: "published" as const,
      date: "2026-11-10",
    };
    expect(filterHolidays([h, live], "All", false)).toEqual([live]);
    expect(filterHolidays([h, live], "All", true)).toHaveLength(2);
    expect(filterHolidays([h], "CSW", true)).toHaveLength(0);
  });
});
describe("backwards compatible persistence", () => {
  afterEach(() => vi.unstubAllGlobals());
  function setup() {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
    });
  }
  it("saves multiple selected dates once, edits and preserves history with SH", () => {
    setup();
    localScheduleRepository.save({
      version: 1,
      shifts: [],
      availability: [a],
      shItems: [h],
    });
    const data = localScheduleRepository.load();
    expect(data.availability[0].dates).toHaveLength(2);
    data.availability[0].dates = toggleDate(
      data.availability[0].dates,
      "2026-12-01",
    );
    localScheduleRepository.save({
      ...data,
      shItems: [{ ...h, status: "published" }],
    });
    expect(localScheduleRepository.load().availability[0].dates).toHaveLength(
      3,
    );
    expect(localScheduleRepository.load().shItems?.[0].status).toBe(
      "published",
    );
    expect(
      employeeHours(localScheduleRepository.load().shifts, "alex"),
    ).toEqual({ published: 0, draft: 0 });
  });
  it("reads old data without requiring SH fields or resetting records", () => {
    setup();
    localScheduleRepository.save({
      version: 1,
      shifts: [s],
      availability: [a],
    });
    expect(localScheduleRepository.load()).toEqual({
      version: 1,
      shifts: [s],
      availability: [a],
    });
  });
  it("rejects stored SH and shift conflicts", () => {
    setup();
    localScheduleRepository.save({
      version: 1,
      shifts: [s],
      availability: [a],
      shItems: [h],
    });
    expect(() => localScheduleRepository.load()).toThrow(/SH records/);
  });
});
