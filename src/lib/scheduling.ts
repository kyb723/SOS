export const BRANCHES = ["ST", "CSW", "SOHO W"] as const;
export type Branch = (typeof BRANCHES)[number];
export type Employee = { id: string; name: string; role: string };
export type Shift = {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  branch: Branch;
  status: "draft" | "published";
};
export type Availability = {
  submittedAt?: string;
  id: string;
  employeeId: string;
  dates: string[];
  start: string;
  end: string;
  allDay: boolean;
  branches: Branch[];
};
export type DemoData = {
  version: 1;
  shifts: Shift[];
  availability: Availability[];
};
export const employees: Employee[] = [
  { id: "alex", name: "Alex Chan", role: "Shift lead" },
  { id: "jamie", name: "Jamie Lee", role: "Barista" },
  { id: "sam", name: "Sam Wong", role: "Barista" },
  { id: "riley", name: "Riley Ho", role: "Barista" },
  { id: "casey", name: "Casey Lam", role: "Service crew" },
  { id: "taylor", name: "Taylor Cheung", role: "Service crew" },
];
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: string) {
  const d = new Date(`${value}T12:00:00`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(d.getTime()) &&
    dateKey(d) === value
  );
}
export function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function shiftsOverlap(a: Shift, b: Shift) {
  return (
    a.employeeId === b.employeeId &&
    a.date === b.date &&
    a.start < b.end &&
    b.start < a.end
  );
}
export function validateShift(shift: Shift, shifts: Shift[]): string | null {
  if (!employees.some((e) => e.id === shift.employeeId))
    return "Choose a team member.";
  if (!validDate(shift.date)) return "Choose a valid shift date.";
  if (!BRANCHES.includes(shift.branch)) return "Choose a branch.";
  if (!["draft", "published"].includes(shift.status))
    return "Choose a valid status.";
  if (
    !validTime(shift.start) ||
    !validTime(shift.end) ||
    shift.start >= shift.end
  )
    return "Finish must be after start. Overnight shifts are not supported yet.";
  if (
    shifts.some((other) => other.id !== shift.id && shiftsOverlap(shift, other))
  )
    return "This team member already has an overlapping shift. Check all branches, including drafts.";
  return null;
}
export function validateAvailability(a: Availability): string | null {
  if (!employees.some((e) => e.id === a.employeeId))
    return "Choose a team member.";
  if (!a.dates.length || a.dates.some((d) => !validDate(d)))
    return "Choose at least one valid date.";
  if (!a.branches.length || a.branches.some((b) => !BRANCHES.includes(b)))
    return "Choose at least one preferred branch.";
  if (
    !a.allDay &&
    (!validTime(a.start) || !validTime(a.end) || a.start >= a.end)
  )
    return "Latest finish must be after earliest start.";
  return null;
}
export function makeSeed(now = new Date()): DemoData {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const shifts: Shift[] = [];
  employees.forEach((e, i) => {
    for (let d = 1; d <= days; d++) {
      if ((d + i) % 7 === 0 || (d + i) % 7 === 1) continue;
      shifts.push({
        id: `seed-${i}-${d}`,
        employeeId: e.id,
        date: dateKey(new Date(now.getFullYear(), now.getMonth(), d)),
        start: i % 2 ? "10:00" : "08:00",
        end: i % 2 ? "18:00" : "16:00",
        branch: BRANCHES[(i + Math.floor(d / 7)) % 3],
        status: d > 20 ? "draft" : "published",
      });
    }
  });
  return {
    version: 1,
    shifts,
    availability: employees.slice(0, 3).map((e, i) => ({
      id: `available-${i}`,
      employeeId: e.id,
      dates: [dateKey(new Date(now.getFullYear(), now.getMonth(), 7 - i))],
      start: "09:00",
      end: "18:00",
      allDay: i === 0,
      branches: [...BRANCHES],
    })),
  };
}

export const branchTone: Record<Branch, string> = {
  ST: "st",
  CSW: "csw",
  "SOHO W": "soho",
};
export function shiftHours(s: Shift) {
  return (minutes(s.end) - minutes(s.start)) / 60;
}
function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function filterShifts(
  shifts: Shift[],
  month: string,
  branch: Branch | "All",
  manager: boolean,
) {
  return shifts.filter(
    (s) =>
      s.date.startsWith(month) &&
      (branch === "All" || s.branch === branch) &&
      (manager || s.status === "published"),
  );
}
export function employeeHours(shifts: Shift[], employeeId: string) {
  const own = shifts.filter((s) => s.employeeId === employeeId);
  return {
    published: own
      .filter((s) => s.status === "published")
      .reduce((n, s) => n + shiftHours(s), 0),
    draft: own
      .filter((s) => s.status === "draft")
      .reduce((n, s) => n + shiftHours(s), 0),
  };
}
export function formatHours(hours: number) {
  return Number(hours.toFixed(2)).toString();
}
export function availabilityCovers(a: Availability, s: Shift) {
  return (
    a.employeeId === s.employeeId &&
    a.dates.includes(s.date) &&
    a.branches.includes(s.branch) &&
    (a.allDay || (a.start <= s.start && a.end >= s.end))
  );
}
export function availabilityStatus(
  a: Availability,
  shifts: Shift[],
): "Not Scheduled" | "Partially Scheduled" | "Scheduled" {
  const days = a.dates.map((date) => {
    const assigned = shifts.filter(
      (s) => s.employeeId === a.employeeId && s.date === date,
    );
    return {
      full:
        assigned.length > 0 && assigned.every((s) => availabilityCovers(a, s)),
      partial: assigned.some(
        (s) =>
          a.branches.includes(s.branch) &&
          (a.allDay || (s.start < a.end && a.start < s.end)),
      ),
    };
  });
  if (days.length && days.every((d) => d.full)) return "Scheduled";
  if (days.some((d) => d.partial)) return "Partially Scheduled";
  return "Not Scheduled";
}
export function availabilityWarning(s: Shift, availability: Availability[]) {
  const sameDay = availability.filter(
    (a) => a.employeeId === s.employeeId && a.dates.includes(s.date),
  );
  if (!sameDay.length)
    return "No availability submitted for this date. Confirm with the employee before saving.";
  if (!sameDay.some((a) => availabilityCovers(a, s)))
    return "Outside submitted availability: check time range and acceptable branches before saving.";
  return null;
}
export function validateAvailabilitySubmission(
  a: Availability,
  records: Availability[],
) {
  const error = validateAvailability(a);
  if (error) return error;
  if (new Set(a.dates).size !== a.dates.length)
    return "Remove duplicate dates.";
  const samePreferences = (b: Availability) =>
    a.allDay === b.allDay &&
    (a.allDay || (a.start === b.start && a.end === b.end)) &&
    [...new Set(a.branches)].sort().join("|") ===
      [...new Set(b.branches)].sort().join("|");
  if (
    records.some(
      (b) =>
        b.id !== a.id &&
        b.employeeId === a.employeeId &&
        samePreferences(b) &&
        b.dates.some((d) => a.dates.includes(d)),
    )
  )
    return "An identical availability entry already exists for one of these dates. Edit the existing submission instead.";
  return null;
}
