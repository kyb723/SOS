"use client";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Users,
  Coffee,
  RotateCcw,
  X,
  Check,
  ArrowUpRight,
} from "lucide-react";
import {
  Availability,
  Branch,
  BRANCHES,
  dateKey,
  DemoData,
  employees,
  makeSeed,
  Shift,
  branchTone,
  employeeHours,
  formatHours,
  shiftHours,
  filterShifts,
  availabilityWarning,
  validateAvailabilitySubmission,
  validateShift,
} from "@/lib/scheduling";
import { localScheduleRepository } from "@/lib/storage";

import AvailabilityInbox from "./availability-inbox";

type Editor = "shift" | "availability" | null;
const blankShift = (date: string): Shift => ({
  id: "",
  employeeId: employees[0].id,
  date,
  start: "08:00",
  end: "16:00",
  branch: "ST",
  status: "draft",
});
const blankAvailability = (employeeId: string): Availability => ({
  id: "",
  employeeId,
  dates: [],
  start: "08:00",
  end: "18:00",
  allDay: false,
  branches: ["ST"],
});
export default function Home() {
  const [data, setData] = useState<DemoData>({
    version: 1,
    shifts: [],
    availability: [],
  });
  const [ready, setReady] = useState(false);
  const [manager, setManager] = useState(false);
  const [employee, setEmployee] = useState(employees[0].id);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [editor, setEditor] = useState<Editor>(null);
  const [shift, setShift] = useState<Shift>(() =>
    blankShift(dateKey(new Date())),
  );
  const [availability, setAvailability] = useState<Availability>(() =>
    blankAvailability(employees[0].id),
  );
  const [date, setDate] = useState(dateKey(new Date()));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setData(localScheduleRepository.load());
      } catch {
        setData(makeSeed());
        setStorageWarning(
          "Saved data could not be read. A fresh demo is shown. Reset demo to replace the saved copy.",
        );
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (editor && dialog.current && !dialog.current.open)
      dialog.current.showModal();
    if (!editor && dialog.current?.open) {
      dialog.current.close();
      trigger.current?.focus();
    }
  }, [editor]);
  const save = (next: DemoData, message: string) => {
    setData(next);
    try {
      localScheduleRepository.save(next);
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Browser storage is unavailable or full. Changes work for this visit but will not survive a reload.",
      );
    }
    setNotice(message);
  };
  const close = () => {
    setEditor(null);
    setError("");
  };
  const open = (kind: Editor, existing?: Shift) => {
    trigger.current = document.activeElement as HTMLElement;
    setError("");
    if (kind === "shift") setShift(existing ?? blankShift(dateKey(month)));
    else {
      setAvailability(blankAvailability(employee));
      setDate(dateKey(month));
    }
    setEditor(kind);
  };
  const days = Array.from(
    {
      length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
  );
  const prefix = dateKey(month).slice(0, 7);
  const monthShifts = filterShifts(data.shifts, prefix, "All", manager);
  const visible = filterShifts(data.shifts, prefix, branch, manager);
  const visibleAvailability = data.availability.filter(
    (a) =>
      (manager || a.employeeId === employee) &&
      (branch === "All" || a.branches.includes(branch)),
  );
  const hours = visible.reduce((n, s) => n + shiftHours(s), 0);
  const editAvailability = (a: Availability) => {
    if (!manager && a.employeeId !== employee) return;
    trigger.current = document.activeElement as HTMLElement;
    setAvailability({ ...a, dates: [...a.dates], branches: [...a.branches] });
    setDate(a.dates[0]);
    setError("");
    setEditor("availability");
  };
  const drafts = visible.filter((s) => s.status === "draft");
  const monthTitle = month.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const availableCount = visibleAvailability.reduce(
    (n, a) => n + a.dates.filter((d) => d.startsWith(prefix)).length,
    0,
  );
  const publish = () => {
    const next = data.shifts.map((s) =>
      drafts.some((d) => d.id === s.id)
        ? { ...s, status: "published" as const }
        : s,
    );
    const issue = next.map((s) => validateShift(s, next)).find(Boolean);
    if (issue) {
      setNotice(issue);
      return;
    }
    save(
      { ...data, shifts: next },
      `${drafts.length} shifts published for ${branch === "All" ? "all branches" : branch}.`,
    );
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-mark">
            <Coffee size={25} />
          </span>
          SOS<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-logo">S</span>
          <div>
            Café collective<small>3 branches · Hong Kong</small>
          </div>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <a className="nav-item active" href="#rota">
            <CalendarDays size={18} /> Team rota <span>01</span>
          </a>
          <a className="nav-item" href="#branches">
            <MapPin size={18} /> Branch overview
          </a>
          <button className="nav-item" onClick={() => open("availability")}>
            <Users size={18} /> Availability
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-dot" /> Local demo workspace
          <p>
            Made for the people
            <br />
            behind your daily coffee.
          </p>
          <span className="version">SOS / VERSION 01</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> <strong>Team rota</strong>
          </span>
          <div className="mode-switch" aria-label="Demo interface">
            <button
              aria-pressed={!manager}
              className={!manager ? "selected" : ""}
              onClick={() => {
                setManager(false);
                close();
              }}
            >
              Staff Demo
            </button>
            <button
              aria-pressed={manager}
              className={manager ? "selected" : ""}
              onClick={() => {
                setManager(true);
                close();
              }}
            >
              Manager Demo
            </button>
          </div>
        </header>
        <main id="main">
          <div className="simulation">
            <span className="local-dot" /> Simulation only — no secure
            authentication. All people and shifts are fictional.
          </div>
          <div className="page-heading">
            <div>
              <p className="eyebrow">THE CAFÉ COLLECTIVE</p>
              <h1>A good shift starts here.</h1>
              <p>Three branches. One team. A little more in sync.</p>
            </div>
            <button
              className="subtle reset"
              disabled={!ready}
              onClick={() => {
                if (
                  confirm(
                    "Reset all demo shifts and availability? This cannot be undone.",
                  )
                )
                  save(
                    makeSeed(),
                    "Demo restored to sample data for the current month.",
                  );
              }}
            >
              <RotateCcw size={15} /> Reset demo
            </button>
          </div>
          {storageWarning && (
            <p className="warning" role="alert">
              {storageWarning}
            </p>
          )}
          <div className="feedback" role="status">
            {notice ||
              (!ready
                ? "Loading your local rota…"
                : "Demo changes are saved in this browser only.")}
          </div>
          <section
            className="branch-grid"
            id="branches"
            aria-label="Branch overview"
          >
            {BRANCHES.map((b, i) => {
              const count = monthShifts.filter((s) => s.branch === b).length;
              return (
                <button
                  key={b}
                  data-branch={branchTone[b]}
                  className={`branch-card ${branch === b ? "chosen" : ""}`}
                  onClick={() => setBranch(branch === b ? "All" : b)}
                  aria-pressed={branch === b}
                >
                  <div className="branch-top">
                    <span>0{i + 1} / BRANCH</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h2>{b}</h2>
                  <div className="branch-bottom">
                    <span>{["Sha Tin", "Cheung Sha Wan", "Soho West"][i]}</span>
                    <strong>
                      {count} <span>shifts</span>
                    </strong>
                  </div>
                </button>
              );
            })}
          </section>
          <section id="rota" className="rota-panel">
            <div className="rota-heading">
              <div>
                <h2>
                  Team rota{" "}
                  <span className="count">{employees.length} people</span>
                </h2>
                <p>
                  {manager
                    ? "Build the plan. Publish when your team is ready."
                    : "Your team’s published shifts, all in one place."}
                </p>
              </div>
              <div className="actions">
                <button
                  className="subtle"
                  disabled={!ready}
                  onClick={() => open("availability")}
                >
                  <Plus size={16} /> Availability
                </button>
                {manager && (
                  <button
                    className="primary"
                    disabled={!ready}
                    onClick={() => open("shift")}
                  >
                    <Plus size={16} /> Add shift
                  </button>
                )}
              </div>
            </div>
            <div className="rota-toolbar">
              <div className="month-switch">
                <button
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <h3>{monthTitle}</h3>
                <button
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  className="today"
                  onClick={() =>
                    setMonth(
                      new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1,
                      ),
                    )
                  }
                >
                  Today
                </button>
              </div>
              <label className="filter-label" htmlFor="branch-filter">
                Branch
                <select
                  aria-label="Branch"
                  data-branch={
                    branch !== "All" ? branchTone[branch] : undefined
                  }
                  id="branch-filter"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value as Branch | "All")}
                >
                  <option value="All">All Branches</option>
                  {BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rota-summary">
              <span>
                <strong>{visible.length}</strong> shifts
              </span>
              <span>
                <strong>{formatHours(hours)}</strong> scheduled hours{" "}
                {manager && "(incl. drafts)"}
              </span>
              <span>
                <strong>{availableCount}</strong> available days
              </span>
              {manager && (
                <button
                  className="publish"
                  disabled={!drafts.length}
                  onClick={publish}
                >
                  <Check size={15} /> Publish {drafts.length} drafts
                </button>
              )}
            </div>
            <p className="scroll-hint">
              Swipe or scroll sideways to see the full month.
              {manager ? " Select a shift to edit." : ""}
            </p>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable monthly team rota"
            >
              <table>
                <caption className="sr-only">
                  {monthTitle} rota,{" "}
                  {branch === "All" ? "all branches" : branch}.{" "}
                  {manager
                    ? "Draft and published shifts"
                    : "Published shifts only"}
                  .
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="staff-cell">
                      Team member
                      <span>
                        {manager ? "Planning view" : "Published view"}
                      </span>
                    </th>
                    {days.map((d) => (
                      <th
                        scope="col"
                        key={dateKey(d)}
                        className={`${[0, 6].includes(d.getDay()) ? "weekend" : ""} ${dateKey(d) === dateKey(new Date()) ? "current-day" : ""}`}
                      >
                        <span>
                          {d.toLocaleDateString("en-GB", { weekday: "short" })}
                        </span>
                        <b>{d.getDate().toString().padStart(2, "0")}</b>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, i) => (
                    <tr key={e.id}>
                      <th scope="row" className="staff-cell">
                        <div className="person">
                          <span className={`avatar avatar-${i}`}>
                            {e.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")}
                          </span>
                          <div>
                            {e.name}
                            <span className="employee-hours">
                              {formatHours(
                                employeeHours(visible, e.id).published,
                              )}
                              h
                              {manager &&
                                employeeHours(visible, e.id).draft > 0 && (
                                  <small>
                                    {" "}
                                    +
                                    {formatHours(
                                      employeeHours(visible, e.id).draft,
                                    )}
                                    h draft
                                  </small>
                                )}
                            </span>
                            <span>{e.role}</span>
                          </div>
                        </div>
                      </th>
                      {days.map((d) => {
                        const key = dateKey(d);
                        const shifts = visible.filter(
                          (s) => s.employeeId === e.id && s.date === key,
                        );
                        const available = visibleAvailability.filter(
                          (a) => a.employeeId === e.id && a.dates.includes(key),
                        );
                        return (
                          <td
                            key={key}
                            className={`${[0, 6].includes(d.getDay()) ? "weekend" : ""} ${key === dateKey(new Date()) ? "current-day" : ""}`}
                          >
                            {shifts.map((s) =>
                              manager ? (
                                <button
                                  key={s.id}
                                  data-branch={branchTone[s.branch]}
                                  className={`shift ${s.status}`}
                                  onClick={() => open("shift", s)}
                                  aria-label={`Edit ${e.name}, ${s.date}, ${s.start} to ${s.end}, ${s.branch}, ${s.status}`}
                                >
                                  <strong>
                                    {s.start}–{s.end}
                                  </strong>
                                  <span>
                                    {s.branch}{" "}
                                    <small>
                                      {s.status === "draft" ? "Draft" : "Live"}
                                    </small>
                                  </span>
                                </button>
                              ) : (
                                <div
                                  key={s.id}
                                  data-branch={branchTone[s.branch]}
                                  className="shift published"
                                >
                                  <strong>
                                    {s.start}–{s.end}
                                  </strong>
                                  <span>
                                    {s.branch} <small>Live</small>
                                  </span>
                                </div>
                              ),
                            )}
                            {available.length > 0 && (
                              <div
                                className="availability-mark"
                                title={available
                                  .map(
                                    (a) =>
                                      `${a.allDay ? "All day" : a.start + "–" + a.end} · ${a.branches.join(", ")}`,
                                  )
                                  .join("; ")}
                              >
                                Available
                                {available.map((a) => (
                                  <small key={a.id}>
                                    {a.allDay
                                      ? "All day"
                                      : `${a.start}–${a.end}`}{" "}
                                    · {a.branches.join("/")}
                                  </small>
                                ))}
                              </div>
                            )}
                            {!shifts.length && !available.length && (
                              <span className="off">
                                OFF<small>No shift in this view</small>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rota-footer">
              <div className="legend">
                {BRANCHES.map((b) => (
                  <span
                    className="branch-badge"
                    data-branch={branchTone[b]}
                    key={b}
                  >
                    {b}
                  </span>
                ))}
                <span>
                  <i className="live-key" /> Published
                </span>
                {manager && (
                  <span>
                    <i className="draft-key" /> Draft
                  </span>
                )}
                <span>
                  <i className="available-key" /> Availability
                </span>
                <span>
                  <i className="off-key" /> OFF
                </span>
              </div>
              <span>
                Scheduled hours, not paid hours · no break deductions · Hong
                Kong
              </span>
            </div>
          </section>
          <section className="lower-grid">
            <AvailabilityInbox
              records={data.availability}
              shifts={data.shifts.filter(
                (s) => manager || s.status === "published",
              )}
              manager={manager}
              employee={employee}
              onEmployee={setEmployee}
              onEdit={editAvailability}
              onRemove={(a) => {
                if (!manager && a.employeeId !== employee) return;
                if (
                  confirm(
                    "Remove this availability submission? Scheduled shifts will be kept.",
                  )
                )
                  save(
                    {
                      ...data,
                      availability: data.availability.filter(
                        (x) => x.id !== a.id,
                      ),
                    },
                    "Availability removed.",
                  );
              }}
            />
            <div className="notes-panel planning-note">
              <Coffee size={25} />
              <h2>Room for a better rhythm.</h2>
              <p>
                Availability is a preference, not an assigned shift. Managers
                can plan across branches; SOS checks for overlapping times
                before saving.
              </p>
              <div>
                <span className="local-dot" />{" "}
                {manager
                  ? "Drafts stay private until published."
                  : "Only published shifts appear in Staff Demo."}
              </div>
            </div>
          </section>
          <footer className="page-footer">
            <span>SOS · Staff operations, simplified.</span>
            <span>Local prototype / No cloud sync</span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-labelledby="editor-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">
              {editor === "shift" ? "MANAGER DEMO" : "TEAM AVAILABILITY"}
            </p>
            <h2 id="editor-title">
              {editor === "shift"
                ? shift.id
                  ? "Edit shift"
                  : "Plan a shift"
                : "When can you work?"}
            </h2>
          </div>
          <button
            aria-label="Close editor"
            className="icon-button"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {editor === "shift" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manager) return;
              const issue = validateShift(shift, data.shifts);
              if (issue) {
                setError(issue);
                return;
              }
              save(
                {
                  ...data,
                  shifts: [
                    ...data.shifts.filter((s) => s.id !== shift.id),
                    { ...shift, id: shift.id || crypto.randomUUID() },
                  ],
                },
                "Shift saved. Drafts are hidden in Staff Demo.",
              );
              close();
            }}
          >
            <label htmlFor="shift-employee">
              Team member
              <select
                aria-label="Team member"
                id="shift-employee"
                value={shift.employeeId}
                onChange={(e) =>
                  setShift({ ...shift, employeeId: e.target.value })
                }
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Date
                <input
                  required
                  type="date"
                  value={shift.date}
                  onChange={(e) => setShift({ ...shift, date: e.target.value })}
                />
              </label>
              <label htmlFor="shift-branch">
                Branch
                <select
                  aria-label="Branch"
                  data-branch={branchTone[shift.branch]}
                  id="shift-branch"
                  value={shift.branch}
                  onChange={(e) =>
                    setShift({ ...shift, branch: e.target.value as Branch })
                  }
                >
                  {BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label>
                Start time
                <input
                  required
                  type="time"
                  value={shift.start}
                  onChange={(e) =>
                    setShift({ ...shift, start: e.target.value })
                  }
                />
              </label>
              <label>
                Finish time
                <input
                  required
                  type="time"
                  value={shift.end}
                  onChange={(e) => setShift({ ...shift, end: e.target.value })}
                />
              </label>
            </div>
            <label htmlFor="shift-status">
              Status
              <select
                aria-label="Status"
                id="shift-status"
                value={shift.status}
                onChange={(e) =>
                  setShift({
                    ...shift,
                    status: e.target.value as Shift["status"],
                  })
                }
              >
                <option value="draft">Draft — manager only</option>
                <option value="published">Published — visible to staff</option>
              </select>
            </label>
            <p className="form-help">
              Same-day shifts only. Overlap checks include drafts at every
              branch.
            </p>
            {availabilityWarning(shift, data.availability) && (
              <p className="warning" role="status">
                {availabilityWarning(shift, data.availability)}
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              {shift.id && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm("Delete this shift?")) {
                      save(
                        {
                          ...data,
                          shifts: data.shifts.filter((s) => s.id !== shift.id),
                        },
                        "Shift deleted.",
                      );
                      close();
                    }
                  }}
                >
                  Delete shift
                </button>
              )}
              <button type="button" className="subtle" onClick={close}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Save shift
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manager && availability.employeeId !== employee) return;
              const issue = validateAvailabilitySubmission(
                availability,
                data.availability,
              );
              if (issue) {
                setError(issue);
                return;
              }
              save(
                {
                  ...data,
                  availability: [
                    ...data.availability.filter(
                      (a) => a.id !== availability.id,
                    ),
                    {
                      ...availability,
                      dates: [...availability.dates].sort(),
                      id: availability.id || crypto.randomUUID(),
                      submittedAt: availability.id
                        ? availability.submittedAt
                        : new Date().toISOString(),
                    },
                  ],
                },
                "Availability saved. Scheduled shifts are unchanged.",
              );
              close();
            }}
          >
            <label htmlFor="availability-employee">
              Team member
              <select
                aria-label="Team member"
                id="availability-employee"
                disabled={!manager}
                value={availability.employeeId}
                onChange={(e) =>
                  setAvailability({
                    ...availability,
                    employeeId: e.target.value,
                  })
                }
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="available-date">Choose dates</label>
            <div className="date-add">
              <input
                id="available-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                type="button"
                className="subtle"
                onClick={() => {
                  if (!date) {
                    setError("Choose a date to add.");
                    return;
                  }
                  setAvailability({
                    ...availability,
                    dates: [...new Set([...availability.dates, date])].sort(),
                  });
                  setError("");
                }}
              >
                Add date
              </button>
            </div>
            <p className="form-help">
              Add one or more dates below before submitting.
            </p>
            <div className="date-chips">
              {availability.dates.map((d) => (
                <button
                  type="button"
                  key={d}
                  aria-label={`Remove ${d}`}
                  onClick={() =>
                    setAvailability({
                      ...availability,
                      dates: availability.dates.filter((x) => x !== d),
                    })
                  }
                >
                  {d}
                  <X size={13} />
                </button>
              ))}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={availability.allDay}
                onChange={(e) =>
                  setAvailability({ ...availability, allDay: e.target.checked })
                }
              />{" "}
              All-day availability
            </label>
            <div className="form-grid">
              <label>
                Earliest start
                <input
                  type="time"
                  required={!availability.allDay}
                  disabled={availability.allDay}
                  value={availability.start}
                  onChange={(e) =>
                    setAvailability({ ...availability, start: e.target.value })
                  }
                />
              </label>
              <label>
                Latest finish
                <input
                  type="time"
                  required={!availability.allDay}
                  disabled={availability.allDay}
                  value={availability.end}
                  onChange={(e) =>
                    setAvailability({ ...availability, end: e.target.value })
                  }
                />
              </label>
            </div>
            <fieldset>
              <legend>Preferred branches · choose one or more</legend>
              <div className="branch-checks">
                {BRANCHES.map((b) => (
                  <label
                    key={b}
                    className="checkbox-label"
                    data-branch={branchTone[b]}
                  >
                    <input
                      type="checkbox"
                      checked={availability.branches.includes(b)}
                      onChange={(e) =>
                        setAvailability({
                          ...availability,
                          branches: e.target.checked
                            ? [...availability.branches, b]
                            : availability.branches.filter((x) => x !== b),
                        })
                      }
                    />
                    {b}
                  </label>
                ))}
              </div>
            </fieldset>
            <section
              className="submission-summary"
              aria-label="Availability summary"
            >
              <strong>Review before saving</strong>
              <p>
                {availability.dates.length
                  ? availability.dates.join(", ")
                  : "No dates selected"}
                <br />
                {availability.allDay
                  ? "All day"
                  : `${availability.start}–${availability.end}`}{" "}
                · {availability.branches.join(" / ") || "No branches selected"}
              </p>
            </section>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="subtle" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Submit availability
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
