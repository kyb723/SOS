"use client";
import { useEffect, useRef, useState } from "react";
import {
  Availability,
  branchTone,
  dateKey,
  employees,
  employeeHours,
  formatHours,
  Shift,
  StatutoryHoliday,
  weekDays,
} from "@/lib/scheduling";
function DayDetails({
  employeeId,
  date,
  shifts,
  holidays,
  availability,
  manager,
  onShift,
  onHoliday,
  onClose,
}: {
  employeeId: string;
  date: string;
  shifts: Shift[];
  holidays: StatutoryHoliday[];
  availability: Availability[];
  manager: boolean;
  onShift: (s: Shift) => void;
  onHoliday: (h: StatutoryHoliday) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="day-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="day-title">
          {employees.find((e) => e.id === employeeId)?.name}
          <small className="day-subtitle">{date}</small>
        </h2>
        <button
          className="icon-button"
          aria-label="Close day details"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {shifts.map((s) => (
        <div
          className={`shift ${s.status}`}
          data-branch={branchTone[s.branch]}
          key={s.id}
        >
          <strong>
            {s.start}–{s.end} · {s.branch}
          </strong>
          <p>
            {s.status} ·{" "}
            {formatHours(
              (+s.end.slice(0, 2) * 60 +
                +s.end.slice(3) -
                (+s.start.slice(0, 2) * 60 + +s.start.slice(3))) /
                60,
            )}{" "}
            scheduled hours
          </p>
          {manager && (
            <button
              className="subtle"
              onClick={() => {
                onClose();
                onShift(s);
              }}
            >
              Edit working shift
            </button>
          )}
        </div>
      ))}
      {holidays.map((h) => (
        <div className="sh-item" key={h.id}>
          <strong>{h.code} · statutory holiday</strong>
          <p>
            {h.branch} · {h.status} · zero working hours
          </p>
          {manager && (
            <button
              className="subtle"
              onClick={() => {
                onClose();
                onHoliday(h);
              }}
            >
              Edit SH item
            </button>
          )}
        </div>
      ))}
      {availability.map((a) => (
        <p className="availability-mark" key={a.id}>
          Available: {a.allDay ? "All day" : `${a.start}–${a.end}`} ·{" "}
          {a.branches.join(" / ")}
        </p>
      ))}
      {!shifts.length && !holidays.length && (
        <p>No scheduled item in this view.</p>
      )}
      <button className="subtle" onClick={onClose}>
        Done
      </button>
    </dialog>
  );
}
export default function MobileRota({
  month,
  shifts,
  monthlyShifts,
  holidays,
  availability,
  manager,
  onShift,
  onHoliday,
}: {
  month: Date;
  shifts: Shift[];
  monthlyShifts: Shift[];
  holidays: StatutoryHoliday[];
  availability: Availability[];
  manager: boolean;
  onShift: (s: Shift) => void;
  onHoliday: (h: StatutoryHoliday) => void;
}) {
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return now.getFullYear() === month.getFullYear() &&
      now.getMonth() === month.getMonth()
      ? now
      : new Date(month);
  });
  const [detail, setDetail] = useState<{
    employeeId: string;
    date: string;
  } | null>(null);
  const days = weekDays(anchor);
  const move = (n: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + n * 7);
    setAnchor(d);
  };
  return (
    <section className="mobile-rota" aria-label="Weekly mobile rota">
      <div className="week-navigation">
        <button aria-label="Previous week" onClick={() => move(-1)}>
          ‹
        </button>
        <strong>
          {days[0].toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
          –
          {days[6].toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </strong>
        <button aria-label="Next week" onClick={() => move(1)}>
          ›
        </button>
      </div>
      <p className="mobile-help">
        SW = SOHO W · D = Draft · Av = Available. Tap for details. Monthly
        hours: {month.toLocaleDateString("en-GB", { month: "long" })}
      </p>
      <table className="week-table">
        <thead>
          <tr>
            <th scope="col">Team</th>
            {days.map((d) => (
              <th
                scope="col"
                key={dateKey(d)}
                aria-current={
                  dateKey(d) === dateKey(new Date()) ? "date" : undefined
                }
              >
                <span>
                  {d.toLocaleDateString("en-GB", { weekday: "narrow" })}
                </span>
                {d.getDate()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const h = employeeHours(monthlyShifts, e.id);
            return (
              <tr key={e.id}>
                <th scope="row">
                  {e.name.split(" ")[0]}
                  <span>{formatHours(h.published)}h</span>
                  {manager && h.draft > 0 && (
                    <small>+{formatHours(h.draft)}h draft</small>
                  )}
                </th>
                {days.map((d) => {
                  const key = dateKey(d);
                  const own = shifts.filter(
                    (s) => s.employeeId === e.id && s.date === key,
                  );
                  const sh = holidays.filter(
                    (h) => h.employeeId === e.id && h.date === key,
                  );
                  const av = availability.filter(
                    (a) => a.employeeId === e.id && a.dates.includes(key),
                  );
                  return (
                    <td key={key}>
                      <button
                        className="week-day"
                        aria-label={`${e.name}, ${key}, ${own.length} shifts, ${sh.map((h) => h.code).join(" ") || "no SH"}, ${av.length ? "available" : "no availability"}`}
                        onClick={() =>
                          setDetail({ employeeId: e.id, date: key })
                        }
                      >
                        {own.length ? (
                          own.slice(0, 1).map((s) => (
                            <span
                              key={s.id}
                              data-branch={branchTone[s.branch]}
                              className={`compact-shift ${s.status}`}
                            >
                              {s.branch === "SOHO W" ? "SW" : s.branch}
                              <small>
                                {s.status === "draft" ? "D" : "Live"}
                              </small>
                              {own.length > 1 && (
                                <small>+{own.length - 1}</small>
                              )}
                            </span>
                          ))
                        ) : sh.length ? (
                          <span className={`compact-sh sh-${sh[0].status}`}>
                            {sh[0].code}
                            <small>
                              {sh[0].status === "draft" ? "D" : "Live"}
                            </small>
                          </span>
                        ) : av.length ? (
                          <span className="compact-available">Av</span>
                        ) : (
                          <span className="compact-off">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {detail && (
        <DayDetails
          {...detail}
          shifts={shifts.filter(
            (s) => s.employeeId === detail.employeeId && s.date === detail.date,
          )}
          holidays={holidays.filter(
            (h) => h.employeeId === detail.employeeId && h.date === detail.date,
          )}
          availability={availability.filter(
            (a) =>
              a.employeeId === detail.employeeId &&
              a.dates.includes(detail.date),
          )}
          manager={manager}
          onShift={onShift}
          onHoliday={onHoliday}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}
