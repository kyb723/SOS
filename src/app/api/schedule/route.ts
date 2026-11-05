import { NextRequest, NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { loadShared } from "@/lib/supabase/schedule";
import { scheduleChanges } from "@/lib/shared-schedule";
import {
  validateAvailabilitySubmission,
  validateScheduledShift,
  validateHoliday,
  validDate,
} from "@/lib/scheduling";
import type {
  DemoData,
  Availability,
  Shift,
  StatutoryHoliday,
} from "@/lib/scheduling";
export const dynamic = "force-dynamic";
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  if (!supabaseConfigured())
    return reply({ error: "Shared workspace is not configured." }, 503);
  try {
    return reply(await loadShared(await createClient()));
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Unable to load rota." },
      e instanceof Error && e.message.startsWith("Active organisation")
        ? 403
        : 401,
    );
  }
}
export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") !==
    (process.env.SOS_APP_ORIGIN
      ? new URL(process.env.SOS_APP_ORIGIN).origin
      : `${request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "")}://${request.headers.get("host") || request.nextUrl.host}`)
  )
    return reply({ error: "Same-origin request required." }, 403);
  if (!supabaseConfigured())
    return reply({ error: "Shared workspace is not configured." }, 503);
  try {
    const text = await request.text();
    if (text.length > 1_000_000)
      return reply({ error: "Request too large." }, 413);
    const body = JSON.parse(text);
    const client = await createClient();
    const before = await loadShared(client);
    if (body.revision !== before.revision)
      return reply(
        { error: "Schedule changed. Synchronise before saving." },
        409,
      );
    let result;
    if (body.action === "publish") {
      if (before.actor.role !== "MANAGER")
        return reply({ error: "Manager role required." }, 403);
      if (
        typeof body.month !== "string" ||
        !/^\d{4}-\d{2}$/.test(body.month) ||
        !validDate(body.month + "-01")
      )
        return reply({ error: "Invalid month." }, 400);
      result = await client.rpc("sos_publish_month", {
        month_start: body.month + "-01",
        expected_revision: before.revision,
      });
    } else if (body.action === "save") {
      const next = body.data as DemoData;
      if (
        next?.version !== 1 ||
        !Array.isArray(next.shifts) ||
        !Array.isArray(next.availability) ||
        !Array.isArray(next.shItems ?? [])
      )
        return reply({ error: "Invalid schedule." }, 400);
      const changes = scheduleChanges(before.data, next, before.actor);
      for (const change of changes) {
        if (change.action === "delete") continue;
        let issue: string | null;
        if (change.kind === "availability")
          issue = validateAvailabilitySubmission(
            change.record as Availability,
            next.availability,
            before.team,
          );
        else if (change.kind === "shift")
          issue = validateScheduledShift(
            change.record as Shift,
            next.shifts,
            next.availability,
            next.shItems,
            before.team,
            before.settings.hours,
          );
        else
          issue = validateHoliday(
            change.record as StatutoryHoliday,
            next.shItems ?? [],
            next.shifts,
            before.settings.codes,
            before.team,
          );
        if (issue) return reply({ error: issue }, 400);
      }
      result = await client.rpc("sos_apply_changes", {
        expected_revision: before.revision,
        changes,
      });
    } else return reply({ error: "Unknown operation." }, 400);
    if (result.error) return reply({ error: result.error.message }, 409);
    try {
      return reply(await loadShared(client));
    } catch {
      return reply(
        {
          error:
            "The write completed but refresh failed. Synchronise to confirm the current rota before retrying.",
        },
        503,
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to save schedule.";
    return reply(
      { error: message },
      message.includes("Sign in required")
        ? 401
        : message.includes("Only the owner") ||
            message.includes("Manager role") ||
            message.includes("Active organisation")
          ? 403
          : 400,
    );
  }
}
