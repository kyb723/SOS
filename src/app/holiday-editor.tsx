"use client";
import { useEffect, useRef, useState } from "react";
import {
  BRANCHES,
  Branch,
  employees,
  Shift,
  StatutoryHoliday,
  validateHoliday,
} from "@/lib/scheduling";
import { SH_CODES, FULL_TIME_EMPLOYEE_IDS } from "@/lib/rota-config";
export default function HolidayEditor({
  item,
  items,
  shifts,
  onSave,
  onDelete,
  onClose,
}: {
  item: StatutoryHoliday;
  items: StatutoryHoliday[];
  shifts: Shift[];
  onSave: (h: StatutoryHoliday) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(item);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="sh-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="sh-title">
          {item.id ? "Edit SH item" : "Record statutory holiday"}
        </h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close SH editor"
        >
          ×
        </button>
      </div>
      <p className="form-help">
        Full-time staff · recording only. No entitlement, pay or legal
        compliance calculation. SH occupies a full day and adds zero working
        hours.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const issue = validateHoliday(value, items, shifts);
          if (issue) {
            setError(issue);
            return;
          }
          onSave({ ...value, id: value.id || crypto.randomUUID() });
        }}
      >
        <label>
          Full-time employee
          <select
            aria-label="Full-time employee"
            value={value.employeeId}
            onChange={(e) => setValue({ ...value, employeeId: e.target.value })}
          >
            {employees
              .filter((e) => FULL_TIME_EMPLOYEE_IDS.includes(e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          SH date
          <input
            type="date"
            required
            value={value.date}
            onChange={(e) => setValue({ ...value, date: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            SH code
            <select
              aria-label="SH code"
              value={value.code}
              onChange={(e) => setValue({ ...value, code: e.target.value })}
            >
              {SH_CODES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Recording branch
            <select
              aria-label="Recording branch"
              value={value.branch}
              onChange={(e) =>
                setValue({ ...value, branch: e.target.value as Branch })
              }
            >
              {BRANCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          SH status
          <select
            aria-label="SH status"
            value={value.status}
            onChange={(e) =>
              setValue({
                ...value,
                status: e.target.value as StatutoryHoliday["status"],
              })
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {value.id && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirm("Delete this SH item?")) onDelete(value.id);
              }}
            >
              Delete SH
            </button>
          )}
          <button type="button" className="subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save SH
          </button>
        </div>
      </form>
    </dialog>
  );
}
