"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Home from "../schedule-app";
import type { SharedSnapshot } from "@/lib/shared-schedule";
import type { DemoData } from "@/lib/scheduling";
import { signOut } from "../login/actions";
export default function ConnectedSchedule() {
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const current = useRef<SharedSnapshot | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const sync = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/schedule", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      current.current = result;
      setSnapshot(result);
      setError("");
      setRefreshKey((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synchronisation failed.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => void sync(), 0);
    return () => clearTimeout(timer);
  }, []);
  const write = async (data: DemoData, month?: string) => {
    if (!current.current) return null;
    setBusy(true);
    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: month ? "publish" : "save",
          data,
          month,
          revision: current.current.revision,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      current.current = result;
      setSnapshot(result);
      setError("");
      return result.data as DemoData;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Save failed. Synchronise and retry.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="shared-toolbar">
        <Link href="/">Local demo</Link>
        <span>Shared workspace · Hong Kong</span>
        <button className="subtle" disabled={busy} onClick={sync}>
          {busy ? "Synchronising…" : "Synchronise"}
        </button>
        <form action={signOut}>
          <button className="subtle">Sign out</button>
        </form>
      </div>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {snapshot ? (
        <Home
          key={refreshKey}
          initialData={snapshot.data}
          team={snapshot.team}
          operatingHours={snapshot.settings.hours}
          codes={snapshot.settings.codes}
          actor={snapshot.actor}
          onRemoteSave={write}
        />
      ) : (
        <main>
          <p>
            {busy ? "Loading shared team rota…" : "Shared rota is unavailable."}
          </p>
        </main>
      )}
    </>
  );
}
