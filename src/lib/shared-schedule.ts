import type {
  Availability,
  DemoData,
  Employee,
  Shift,
  StatutoryHoliday,
  OperatingHours,
} from "./scheduling";
export type Actor = { id: string; role: "STAFF" | "MANAGER" };
export type SharedSnapshot = {
  data: DemoData;
  team: Employee[];
  actor: Actor;
  revision: number;
  settings: { hours: OperatingHours; codes: string[] };
};
export type Change = {
  kind: "availability" | "shift" | "holiday";
  action: "upsert" | "delete";
  record: Availability | Shift | StatutoryHoliday;
};
function canonical(record: Availability | Shift | StatutoryHoliday) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(record)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]),
    ),
  );
}
export function scheduleChanges(
  before: DemoData,
  after: DemoData,
  actor: Actor,
): Change[] {
  const changes: Change[] = [];
  for (const [kind, oldRows, newRows] of [
    ["availability", before.availability, after.availability],
    ["shift", before.shifts, after.shifts],
    ["holiday", before.shItems ?? [], after.shItems ?? []],
  ] as const) {
    const old = new Map(oldRows.map((r) => [r.id, r]));
    const next = new Map(newRows.map((r) => [r.id, r]));
    for (const row of oldRows)
      if (!next.has(row.id))
        changes.push({ kind, action: "delete", record: row });
    for (const row of newRows)
      if (!old.has(row.id) || canonical(old.get(row.id)!) !== canonical(row))
        changes.push({ kind, action: "upsert", record: row });
  }
  for (const c of changes) {
    if (c.kind === "availability" && c.record.employeeId !== actor.id)
      throw new Error(
        "Only the owner can change availability, including managers.",
      );
    if (c.kind !== "availability" && actor.role !== "MANAGER")
      throw new Error("Manager role required.");
  }
  return changes;
}
