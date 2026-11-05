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
  ArrowUpRight,
} from "lucide-react";
import {
  Availability,
  Branch,
  BRANCHES,
  dateKey,
  DemoData,
  employees as demoEmployees,
  Employee,
  OperatingHours,
  businessToday,
  makeSeed,
  Shift,
  branchTone,
  employeeHours,
  formatHours,
  shiftHours,
  filterShifts,
  availabilityWindows,
  validateScheduledShift,
  planMonthlyPublication,
  validateAvailabilitySubmission,
  StatutoryHoliday,
  conflictingAvailability,
  filterHolidays,
} from "@/lib/scheduling";
import { localScheduleRepository } from "@/lib/storage";

import AvailabilityInbox from "./availability-inbox";

import AvailabilityCalendar from "./availability-calendar";
import MobileRota from "./mobile-rota";
import HolidayEditor from "./holiday-editor";
import {
  SH_CODES as DEFAULT_SH_CODES,
  BRANCH_OPERATING_HOURS,
} from "@/lib/rota-config";

import PublishRota from "./publish-rota";

import type { Actor } from "@/lib/shared-schedule";

type Editor = "shift" | "availability" | "history" | null;
const blankShift = (date: string): Shift => ({
  id: "",
  employeeId: demoEmployees[0].id,
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
export default function Home({
  initialData,
  team = demoEmployees,
  actor,
  onRemoteSave,
  operatingHours = BRANCH_OPERATING_HOURS,
  codes = DEFAULT_SH_CODES,
}: {
  operatingHours?: OperatingHours;
  codes?: readonly string[];
  initialData?: DemoData;
  team?: Employee[];
  actor?: Actor;
  onRemoteSave?: (data: DemoData, month?: string) => Promise<DemoData | null>;
}) {
  const employees = team;
  const SH_CODES = codes;
  const canEditAvailability = (a: Availability) =>
    actor ? a.employeeId === actor.id : manager || a.employeeId === employee;

  const [data, setData] = useState<DemoData>(
    initialData ?? {
      version: 1,
      shifts: [],
      availability: [],
    },
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [weekReset, setWeekReset] = useState(0);
  const [ready, setReady] = useState(!!actor);
  const [manager, setManager] = useState(actor?.role === "MANAGER");
  const [employee, setEmployee] = useState(actor?.id ?? employees[0]?.id ?? "");
  const [month, setMonth] = useState(
    () =>
      new Date(businessToday().getFullYear(), businessToday().getMonth(), 1),
  );
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [editor, setEditor] = useState<Editor>(null);
  const [shift, setShift] = useState<Shift>(() =>
    blankShift(dateKey(businessToday())),
  );
  const [availability, setAvailability] = useState<Availability>(() =>
    blankAvailability(actor?.id ?? employees[0]?.id ?? ""),
  );
  const [holiday, setHoliday] = useState<StatutoryHoliday | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (actor) return;
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
  }, [actor]);
  useEffect(() => {
    if (editor && dialog.current) {
      if (!dialog.current.open) dialog.current.showModal();
      dialog.current.scrollTop = 0;
    }
    if (!editor && dialog.current?.open) {
      dialog.current.close();
      trigger.current?.focus();
    }
  }, [editor, availability.id]);
  const save = async (
    next: DemoData,
    message: string,
    monthToPublish?: string,
  ) => {
    if (actor) {
      const saved = await onRemoteSave?.(next, monthToPublish);
      if (!saved) {
        setStorageWarning(
          "Shared changes could not be confirmed. Synchronise to see current database state before retrying.",
        );
        return false;
      }
      setData(saved);
      setStorageWarning("");
      setNotice(message);
      return true;
    }

    try {
      localScheduleRepository.save(next);
    } catch {
      setStorageWarning(
        "Changes were not saved. Browser storage is unavailable or full. Your current rota is unchanged.",
      );
      return false;
    }
    setData(next);
    setStorageWarning("");
    setNotice(message);
    return true;
  };

  const close = () => {
    setEditor(null);
    setError("");
  };
  const open = (kind: Editor, existing?: Shift) => {
    trigger.current = document.activeElement as HTMLElement;
    setError("");
    if (kind === "shift")
      setShift(
        existing ?? {
          ...blankShift(dateKey(month)),
          employeeId: employees[0]?.id ?? "",
        },
      );
    else {
      setAvailability(blankAvailability(employee));
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
      (actor || manager || a.employeeId === employee) &&
      (branch === "All" || a.branches.includes(branch)),
  );
  const hours = visible.reduce((n, s) => n + shiftHours(s), 0);
  const editAvailability = (a: Availability) => {
    if (!canEditAvailability(a)) return;
    trigger.current = document.activeElement as HTMLElement;
    setAvailability({ ...a, dates: [...a.dates], branches: [...a.branches] });

    setError("");
    setEditor("availability");
  };
  const shItems = data.shItems ?? [];
  const shownSH = filterHolidays(shItems, branch, manager);
  const monthlySH = shownSH.filter((h) => h.date.startsWith(prefix));
  const availabilityConflicts = conflictingAvailability(
    availability,
    data.availability,
  );
  const windows = availabilityWindows(
    shift.employeeId,
    shift.date,
    data.availability,
    operatingHours,
  );
  const permittedBranches = [...new Set(windows.map((w) => w.branch))];
  const activeWindow =
    windows.find(
      (w) =>
        w.branch === shift.branch &&
        w.start <= shift.start &&
        w.end >= shift.end,
    ) ?? windows.find((w) => w.branch === shift.branch);
  const publication = planMonthlyPublication(
    data,
    prefix,
    team,
    operatingHours,
    codes,
  );
  const invalidShifts = data.shifts.filter(
    (s) =>
      s.date.startsWith(prefix) &&
      validateScheduledShift(
        s,
        data.shifts,
        data.availability,
        shItems,
        team,
        operatingHours,
      ),
  );
  const fromAvailability = (employeeId: string, date: string) => {
    const window =
      availabilityWindows(
        employeeId,
        date,
        data.availability,
        operatingHours,
      ).find((w) => branch === "All" || w.branch === branch) ??
      availabilityWindows(
        employeeId,
        date,
        data.availability,
        operatingHours,
      )[0];
    if (!window) return;
    trigger.current = document.activeElement as HTMLElement;
    setShift({
      ...blankShift(date),
      employeeId,
      branch: window.branch,
      start: window.start,
      end: window.end,
    });
    setError("");
    setEditor("shift");
  };
  const monthTitle = month.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const availableCount = visibleAvailability.reduce(
    (n, a) => n + a.dates.filter((d) => d.startsWith(prefix)).length,
    0,
  );
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
          {!actor ? (
            <div className="mode-switch" aria-label="Demo interface">
              <button
                aria-pressed={!manager}
                className={!manager ? "selected" : ""}
                onClick={() => {
                  setManager(false);
                  setPublishOpen(false);
                  setHoliday(null);
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
                  setPublishOpen(false);
                  setHoliday(null);
                  close();
                }}
              >
                Manager Demo
              </button>
            </div>
          ) : (
            <span>{actor.role} · verified workspace</span>
          )}
        </header>
        <main id="main">
          <div className="simulation">
            <span className="local-dot" />{" "}
            {actor
              ? "Authenticated shared rota. Team availability is visible to organisation members."
              : "Simulation only — no secure authentication. All people and shifts are fictional."}
          </div>
          <div className="page-heading">
            <div>
              <p className="eyebrow">THE CAFÉ COLLECTIVE</p>
              <h1>A good shift starts here.</h1>
              <p>Three branches. One team. A little more in sync.</p>
            </div>
            {!actor && (
              <button
                className="subtle reset"
                disabled={!ready}
                onClick={async () => {
                  if (
                    confirm(
                      "Reset all demo shifts and availability? This cannot be undone.",
                    )
                  )
                    await save(
                      makeSeed(),
                      "Demo restored to sample data for the current month.",
                    );
                }}
              >
                <RotateCcw size={15} /> Reset demo
              </button>
            )}
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
                : actor
                  ? "Changes are saved to the shared database."
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
                {manager && (
                  <>
                    <button
                      className="subtle"
                      onClick={() =>
                        setHoliday({
                          id: "",
                          employeeId:
                            employees.find(
                              (e) => e.employmentType === "full-time",
                            )?.id ??
                            employees[0]?.id ??
                            "",
                          date: dateKey(month),
                          branch: branch === "All" ? "ST" : branch,
                          code: SH_CODES[0],
                          status: "draft",
                        })
                      }
                    >
                      + SH
                    </button>
                    <button
                      className="primary"
                      disabled={!ready || !publication.count}
                      onClick={() => setPublishOpen(true)}
                    >
                      Publish Rota · {monthTitle} ({publication.count})
                    </button>
                  </>
                )}
              </div>
            </div>
            {manager && invalidShifts.length > 0 && (
              <div className="invalid-notice" role="status">
                {invalidShifts.length} existing shifts in {monthTitle} need
                correction under the availability rules. They have been
                preserved and marked Invalid. Invalid drafts block monthly
                publication.
              </div>
            )}
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
                  onClick={() => {
                    setMonth(
                      new Date(
                        businessToday().getFullYear(),
                        businessToday().getMonth(),
                        1,
                      ),
                    );
                    setWeekReset((n) => n + 1);
                  }}
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
            </div>
            <p className="scroll-hint">
              Swipe or scroll sideways to see the full month.
              {manager ? " Select a shift to edit." : ""}
            </p>
            <MobileRota
              team={team}
              canEditAvailability={canEditAvailability}
              key={prefix + String(manager) + weekReset}
              month={month}
              shifts={data.shifts.filter(
                (s) =>
                  (manager || s.status === "published") &&
                  (branch === "All" || s.branch === branch),
              )}
              monthlyShifts={visible}
              holidays={shownSH}
              availability={visibleAvailability}
              manager={manager}
              onShift={(s) => open("shift", s)}
              onHoliday={setHoliday}
              onAvailability={(id, date) => fromAvailability(id, date)}
              onEditAvailability={editAvailability}
              invalidIds={invalidShifts.map((s) => s.id)}
            />
            <div
              className="table-scroll desktop-rota"
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
                        className={`${[0, 6].includes(d.getDay()) ? "weekend" : ""} ${dateKey(d) === dateKey(businessToday()) ? "current-day" : ""}`}
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
                            className={`${[0, 6].includes(d.getDay()) ? "weekend" : ""} ${key === dateKey(businessToday()) ? "current-day" : ""}`}
                          >
                            {monthlySH
                              .filter(
                                (h) => h.employeeId === e.id && h.date === key,
                              )
                              .map((h) =>
                                manager ? (
                                  <button
                                    key={h.id}
                                    className={`sh-item sh-${h.status}`}
                                    onClick={() => setHoliday(h)}
                                    aria-label={`Edit ${h.code} for ${e.name} on ${key}`}
                                  >
                                    {h.code}
                                    <small>
                                      {h.branch} · {h.status}
                                    </small>
                                  </button>
                                ) : (
                                  <div className="sh-item" key={h.id}>
                                    {h.code}
                                    <small>{h.branch} · published</small>
                                  </div>
                                ),
                              )}
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
                                    {manager &&
                                      invalidShifts.some(
                                        (x) => x.id === s.id,
                                      ) && (
                                        <span className="invalid-label">
                                          Invalid
                                        </span>
                                      )}
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
                                    {manager &&
                                      invalidShifts.some(
                                        (x) => x.id === s.id,
                                      ) && (
                                        <span className="invalid-label">
                                          Invalid
                                        </span>
                                      )}
                                    {s.start}–{s.end}
                                  </strong>
                                  <span>
                                    {s.branch} <small>Live</small>
                                  </span>
                                </div>
                              ),
                            )}
                            {available.length > 0 && (
                              <div className="grid-availability">
                                {manager ? (
                                  <button
                                    className="availability-mark"
                                    onClick={() => fromAvailability(e.id, key)}
                                    aria-label={`Schedule ${e.name} on ${key} from availability`}
                                  >
                                    Av · Add shift
                                    {available.map((a) => (
                                      <small key={a.id}>
                                        {a.allDay
                                          ? "All day"
                                          : `${a.start}–${a.end}`}{" "}
                                        · {a.branches.join("/")}
                                      </small>
                                    ))}
                                  </button>
                                ) : (
                                  <button
                                    className="availability-mark"
                                    onClick={() =>
                                      editAvailability(available[0])
                                    }
                                  >
                                    Av · Review availability
                                  </button>
                                )}
                                {manager &&
                                  available.map((a) => (
                                    <button
                                      key={a.id}
                                      className="grid-edit"
                                      onClick={() =>
                                        canEditAvailability(a)
                                          ? editAvailability(a)
                                          : setEditor("history")
                                      }
                                    >
                                      Review submission
                                    </button>
                                  ))}
                              </div>
                            )}
                            {!shifts.length &&
                              !available.length &&
                              !monthlySH.some(
                                (h) => h.employeeId === e.id && h.date === key,
                              ) && (
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
                <span>
                  <i className="sh-key" /> SH
                </span>
              </div>
              <span>
                Scheduled hours, not paid hours · no break deductions · Hong
                Kong
              </span>
            </div>
          </section>
          {!actor && (
            <div className="demo-tools">
              <a className="subtle" href="/login">
                Team sign in
              </a>
              <button
                className="subtle"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "sos-demo-backup.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export demo backup
              </button>
            </div>
          )}
          <footer className="page-footer">
            <span>SOS · Staff operations, simplified.</span>
            <span>
              {actor
                ? "Shared Supabase workspace"
                : "Local prototype / No cloud sync"}
            </span>
          </footer>
        </main>
      </div>
      {manager && publishOpen && (
        <PublishRota
          shared={!!actor}
          team={team}
          operatingHours={operatingHours}
          codes={codes}
          data={data}
          month={prefix}
          onClose={() => setPublishOpen(false)}
          onPublish={(next) =>
            save(
              next,
              `Rota published for ${monthTitle} across all branches.`,
              prefix,
            )
          }
        />
      )}
      {manager && holiday && (
        <HolidayEditor
          team={team}
          codes={codes}
          key={holiday.id || "new"}
          item={holiday}
          items={shItems}
          shifts={data.shifts}
          onClose={() => setHoliday(null)}
          onSave={async (h) => {
            if (
              shItems.find((x) => x.id === h.id)?.status === "published" &&
              !confirm("Apply these changes to the published SH item?")
            )
              return;
            const saved = await save(
              {
                ...data,
                shItems: [...shItems.filter((x) => x.id !== h.id), h],
              },
              "SH item saved. It adds zero working hours.",
            );
            if (saved) setHoliday(null);
          }}
          onDelete={async (id) => {
            await save(
              { ...data, shItems: shItems.filter((h) => h.id !== id) },
              "SH item deleted.",
            );
            setHoliday(null);
          }}
        />
      )}
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
                : editor === "history"
                  ? "Availability history"
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
            onSubmit={async (e) => {
              e.preventDefault();
              if (!manager) return;
              const issue = validateScheduledShift(
                shift,
                data.shifts,
                data.availability,
                shItems,
                team,
                operatingHours,
              );
              if (issue) {
                setError(issue);
                return;
              }
              if (
                data.shifts.find((s) => s.id === shift.id)?.status ===
                  "published" &&
                !confirm(
                  "Apply these changes to the published shift? Staff visibility will follow the selected status.",
                )
              )
                return;
              const saved = await save(
                {
                  ...data,
                  shifts: [
                    ...data.shifts.filter((s) => s.id !== shift.id),
                    { ...shift, id: shift.id || crypto.randomUUID() },
                  ],
                },
                "Shift saved. Drafts are hidden in Staff Demo.",
              );
              if (saved) close();
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
                    setShift((prev) => {
                      const w = windows.find(
                        (w) => w.branch === e.target.value,
                      );
                      return {
                        ...prev,
                        branch: e.target.value as Branch,
                        ...(w ? { start: w.start, end: w.end } : {}),
                      };
                    })
                  }
                >
                  {!permittedBranches.includes(shift.branch) && (
                    <option value={shift.branch} disabled>
                      Choose an allowed branch
                    </option>
                  )}
                  {permittedBranches.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label>
                Start time
                <input
                  required
                  type="time"
                  min={activeWindow?.start}
                  max={activeWindow?.end}
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
                  min={activeWindow?.start}
                  max={activeWindow?.end}
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
            <section className="permitted-windows">
              <label>
                Permitted availability interval
                <select
                  aria-label="Permitted availability interval"
                  value={activeWindow ? windows.indexOf(activeWindow) : -1}
                  onChange={(e) => {
                    const w = windows[Number(e.target.value)];
                    if (w)
                      setShift({
                        ...shift,
                        branch: w.branch,
                        start: w.start,
                        end: w.end,
                      });
                  }}
                >
                  <option value={-1} disabled>
                    No matching availability
                  </option>
                  {windows.map((w, i) => (
                    <option key={i} value={i}>
                      {w.branch} · {w.start}–{w.end}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Each shift must fit entirely inside one listed interval. All-day
                submissions use configured branch operating hours.
              </p>
              {!windows.length && (
                <p className="error">
                  No availability for this date. Submit availability before
                  adding a working shift.
                </p>
              )}
            </section>
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
                  onClick={async () => {
                    if (confirm("Delete this shift?")) {
                      await save(
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
        ) : editor === "history" ? (
          <>
            {" "}
            <AvailabilityInbox
              team={team}
              operatingHours={operatingHours}
              canEdit={canEditAvailability}
              shared={!!actor}
              records={data.availability}
              shifts={data.shifts.filter(
                (s) => manager || s.status === "published",
              )}
              manager={manager}
              employee={employee}
              onEmployee={setEmployee}
              onEdit={editAvailability}
              onRemove={async (a) => {
                if (!canEditAvailability(a)) return;
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
            <button className="primary" onClick={() => open("availability")}>
              Submit new availability
            </button>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (actor && availability.employeeId !== actor.id) return;
              if (!actor && !manager && availability.employeeId !== employee)
                return;
              const issue = validateAvailabilitySubmission(
                availability,
                data.availability,
                team,
              );
              if (issue) {
                setError(issue);
                return;
              }
              const saved = await save(
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
              if (saved) close();
            }}
          >
            <button
              type="button"
              className="subtle history-button"
              onClick={() => setEditor("history")}
            >
              View / edit complete availability history
            </button>
            <label htmlFor="availability-employee">
              Team member
              <select
                aria-label="Team member"
                id="availability-employee"
                disabled={!!actor || !manager}
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
            <AvailabilityCalendar
              key={availability.id || "new"}
              initialMonth={
                availability.dates[0]
                  ? new Date(availability.dates[0] + "T12:00:00")
                  : month
              }
              dates={availability.dates}
              onChange={(dates) => {
                setAvailability({ ...availability, dates });
                setError("");
              }}
            />
            {availabilityConflicts.length > 0 && (
              <div className="warning" role="alert">
                <p>
                  Selected dates already have submissions. Deselect those dates,
                  or choose a submission below to edit its original dates and
                  preferences. Nothing is overwritten.
                </p>
                {availabilityConflicts.map((a) => (
                  <button
                    type="button"
                    className="subtle"
                    key={a.id}
                    onClick={() =>
                      canEditAvailability(a)
                        ? editAvailability(a)
                        : setEditor("history")
                    }
                  >
                    Update existing: {a.dates.join(", ")}
                  </button>
                ))}
              </div>
            )}
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
              <button
                type="submit"
                disabled={
                  !!validateAvailabilitySubmission(
                    availability,
                    data.availability,
                    team,
                  )
                }
                className="primary"
              >
                Submit availability
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
