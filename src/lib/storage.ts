import {
  DemoData,
  makeSeed,
  validateAvailability,
  validateShift,
  validateHoliday,
} from "./scheduling";
// Replace this adapter with a Supabase repository later; keep domain validation shared.
export interface ScheduleRepository {
  load(): DemoData;
  save(data: DemoData): void;
}
export const STORAGE_KEY = "sos.demo.v1";
export const localScheduleRepository: ScheduleRepository = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeSeed();
    const data = JSON.parse(raw) as DemoData;
    if (
      data.version !== 1 ||
      !Array.isArray(data.shifts) ||
      !Array.isArray(data.availability)
    )
      throw new Error("Invalid demo data");
    if (
      data.shifts.some(
        (s) => !s || typeof s.id !== "string" || validateShift(s, data.shifts),
      ) ||
      data.availability.some(
        (a) =>
          !a ||
          typeof a.id !== "string" ||
          !Array.isArray(a.dates) ||
          !Array.isArray(a.branches) ||
          validateAvailability(a),
      )
    )
      throw new Error("Invalid demo records");
    if (
      data.shItems !== undefined &&
      (!Array.isArray(data.shItems) ||
        data.shItems.some(
          (h) =>
            !h ||
            typeof h.id !== "string" ||
            validateHoliday(h, data.shItems ?? [], data.shifts),
        ))
    )
      throw new Error("Invalid SH records");
    return data;
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
