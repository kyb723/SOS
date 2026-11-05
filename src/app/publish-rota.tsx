"use client";
import { useEffect, useRef, useState } from "react";
import {
  DemoData,
  Employee,
  OperatingHours,
  employees,
  planMonthlyPublication,
} from "@/lib/scheduling";
export default function PublishRota({
  shared = false,
  team = employees,
  operatingHours,
  codes,
  data,
  month,
  onPublish,
  onClose,
}: {
  shared?: boolean;
  operatingHours?: OperatingHours;
  codes?: readonly string[];
  team?: Employee[];
  data: DemoData;
  month: string;
  onPublish: (data: DemoData) => Promise<boolean>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const plan = planMonthlyPublication(data, month, team, operatingHours, codes);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => trigger?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="publish-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="publish-title">Publish Rota · {month}</h2>
        <button
          aria-label="Close publish confirmation"
          className="icon-button"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p>
        Publish {plan.count} draft items for the entire month across ST, CSW and
        SOHO W, regardless of the branch filter. Other months and existing
        published items stay unchanged.
      </p>
      {plan.errors.length > 0 && (
        <div className="error" role="alert">
          <strong>Publication blocked. Correct these items first:</strong>
          <ul>
            {plan.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="subtle" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={!!plan.errors.length || !plan.count}
          onClick={async () => {
            const latest = planMonthlyPublication(
              data,
              month,
              team,
              operatingHours,
              codes,
            );
            if (latest.errors.length) return;
            if (await onPublish(latest.data)) onClose();
            else
              setError(
                shared
                  ? "Publication could not be confirmed. Synchronise before retrying."
                  : "Nothing was published. Browser storage could not save the complete rota. Try again after resolving storage access.",
              );
          }}
        >
          Confirm publish {plan.count} items
        </button>
      </div>
    </dialog>
  );
}
