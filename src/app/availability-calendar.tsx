"use client";
import { useState } from "react";
import { calendarDays, dateKey, toggleDate } from "@/lib/scheduling";
export default function AvailabilityCalendar({
  dates,
  onChange,
  initialMonth,
}: {
  dates: string[];
  onChange: (dates: string[]) => void;
  initialMonth: Date;
}) {
  const [month, setMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  );
  const move = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  return (
    <section className="date-calendar" aria-label="Choose availability dates">
      <div className="calendar-heading">
        <button
          type="button"
          aria-label="Previous calendar month"
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <h3 aria-live="polite">
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <button
          type="button"
          aria-label="Next calendar month"
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span className="calendar-weekday" key={d}>
            {d}
          </span>
        ))}
        {calendarDays(month).map((d) => {
          const key = dateKey(d);
          return (
            <button
              type="button"
              key={key}
              aria-label={`Select ${key}`}
              aria-pressed={dates.includes(key)}
              aria-current={key === dateKey(new Date()) ? "date" : undefined}
              className={`${d.getMonth() !== month.getMonth() ? "outside-month" : ""} ${dates.includes(key) ? "selected-date" : ""}`}
              onClick={() => onChange(toggleDate(dates, key))}
              onKeyDown={(e) => {
                const offset = (
                  {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  } as Record<string, number>
                )[e.key];
                if (offset) {
                  e.preventDefault();
                  const next = new Date(d);
                  next.setDate(next.getDate() + offset);
                  const target =
                    e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                      `button[aria-label="Select ${dateKey(next)}"]`,
                    );
                  target?.focus();
                }
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <p aria-live="polite">
        {dates.length} dates selected · tap again to deselect
      </p>
    </section>
  );
}
