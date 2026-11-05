"use client";
import { useState } from "react";
import {
  Availability,
  availabilityStatus,
  branchTone,
  employees as demoEmployees,
  Employee,
  OperatingHours,
  Shift,
} from "@/lib/scheduling";
type Props = {
  operatingHours?: OperatingHours;
  team?: Employee[];
  canEdit?: (a: Availability) => boolean;
  shared?: boolean;
  records: Availability[];
  shifts: Shift[];
  manager: boolean;
  employee: string;
  onEmployee: (id: string) => void;
  onEdit: (a: Availability) => void;
  onRemove: (a: Availability) => void;
};
export default function AvailabilityInbox({
  team = demoEmployees,
  operatingHours,
  canEdit,
  shared = false,
  records,
  shifts,
  manager,
  employee,
  onEmployee,
  onEdit,
  onRemove,
}: Props) {
  const employees = team;
  const [person, setPerson] = useState("All");
  const [month, setMonth] = useState("");
  const own = records.filter((a) =>
    manager || shared
      ? person === "All" || a.employeeId === person
      : a.employeeId === employee,
  );
  const rows = own
    .filter((a) => !month || a.dates.some((d) => d.startsWith(month)))
    .sort((a, b) =>
      [...a.dates].sort()[0].localeCompare([...b.dates].sort()[0]),
    );
  return (
    <div className="notes-panel">
      <div className="section-title">
        <h2>Availability inbox</h2>
        <span>Complete submission history</span>
      </div>
      <div className="inbox-filters">
        <label>
          {manager || shared ? "Team member" : "Preview as"}
          <select
            aria-label={manager || shared ? "Inbox employee" : "Preview as"}
            value={manager || shared ? person : employee}
            onChange={(e) =>
              manager || shared
                ? setPerson(e.target.value)
                : onEmployee(e.target.value)
            }
          >
            {(manager || shared) && <option value="All">All employees</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Optional month
          <input
            aria-label="Inbox month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <button className="subtle" onClick={() => setMonth("")}>
          All months
        </button>
      </div>
      <p className="form-help">
        {month
          ? `Showing submissions containing dates in ${month}.`
          : "All months shown."}{" "}
        Rota branch filters do not hide history. Status uses{" "}
        {manager ? "draft and published" : "published"} shifts. All dates in
        each submission stay visible.
      </p>
      {!rows.length ? (
        <p className="empty">
          No submissions in this view. Select All months or submit availability.
        </p>
      ) : (
        <div className="requests">
          {rows.map((a) => (
            <article className="request" key={a.id}>
              <div className="request-content">
                <strong>
                  {employees.find((e) => e.id === a.employeeId)?.name}
                </strong>
                <span className="schedule-status">
                  {availabilityStatus(a, shifts, operatingHours)}
                </span>
                <p>
                  Submitted:{" "}
                  {a.submittedAt && !Number.isNaN(Date.parse(a.submittedAt))
                    ? new Date(a.submittedAt).toLocaleString("en-GB", {
                        timeZone: "Asia/Hong_Kong",
                      }) + " HKT"
                    : "Not recorded (legacy demo)"}
                  <br />
                  Available dates: {[...a.dates].sort().join(", ")}
                  <br />
                  {a.allDay ? "All day" : `${a.start}–${a.end}`}
                </p>
                <div className="branch-badges">
                  {a.branches.map((b) => (
                    <span
                      className="branch-badge"
                      data-branch={branchTone[b]}
                      key={b}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              {(!canEdit || canEdit(a)) && (
                <div className="request-actions">
                  <button
                    className="text-button"
                    onClick={() => onEdit(a)}
                    aria-label={`Edit availability ${a.id}`}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    onClick={() => onRemove(a)}
                    aria-label={`Remove availability ${a.id}`}
                  >
                    Remove
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
