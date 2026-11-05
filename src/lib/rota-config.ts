// Expand this list to offer additional recording codes. No entitlement is calculated.
export const SH_CODES: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `SH${String(i + 1).padStart(2, "0")}`,
);
export const FULL_TIME_EMPLOYEE_IDS = ["alex", "jamie", "sam"];
