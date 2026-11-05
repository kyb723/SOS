// Expand this list to offer additional recording codes. No entitlement is calculated.
export const SH_CODES: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `SH${String(i + 1).padStart(2, "0")}`,
);
export const FULL_TIME_EMPLOYEE_IDS = ["alex", "jamie", "sam"];

// Prototype operating hours in Hong Kong local time; replace with real branch settings later.
export const BRANCH_OPERATING_HOURS = {
  ST: { start: "08:00", end: "20:00" },
  CSW: { start: "08:00", end: "20:00" },
  "SOHO W": { start: "09:00", end: "22:00" },
} as const;
