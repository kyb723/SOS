import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Branch, OperatingHours } from "../scheduling";
import type { SharedSnapshot } from "../shared-schedule";
export async function loadShared(
  client: SupabaseClient,
): Promise<SharedSnapshot> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) throw new Error("Sign in required.");
  const { data: member, error } = await client
    .from("sos_memberships")
    .select("org_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();
  if (error || !member)
    throw new Error(
      "Active organisation membership required. Ask your administrator to approve your invitation.",
    );
  // Read revision before/after so a refresh cannot mix two committed revisions.
  for (let attempt = 0; attempt < 3; attempt++) {
    const first = await client
      .from("sos_revisions")
      .select("revision")
      .eq("org_id", member.org_id)
      .single();
    if (first.error)
      throw new Error(
        "Database setup is incomplete. Apply the SOS migrations and grants.",
      );
    const results = await Promise.all([
      client
        .from("sos_profiles")
        .select("id,display_name,employment_type")
        .order("display_name"),
      client
        .from("sos_availability")
        .select(
          "id,staff_id,starts,finishes,all_day,submitted_at,sos_availability_days(day),sos_availability_branches(branch)",
        )
        .order("submitted_at"),
      client
        .from("sos_shifts")
        .select("id,staff_id,day,starts,finishes,branch,status"),
      client.from("sos_sh_items").select("id,staff_id,day,branch,code,status"),
      client.from("sos_branches").select("code,opens,closes"),
      client.from("sos_sh_codes").select("code").order("code"),
    ]);
    if (results.some((r) => r.error))
      throw new Error(
        "Unable to load the shared rota. Check SQL GRANT permissions, RLS and migration setup.",
      );
    const last = await client
      .from("sos_revisions")
      .select("revision")
      .eq("org_id", member.org_id)
      .single();
    if (last.error) throw new Error("Unable to read schedule revision.");
    if (first.data.revision !== last.data.revision) continue;
    return {
      settings: {
        hours: Object.fromEntries(
          (results[4].data ?? []).map((b) => [
            b.code,
            { start: b.opens.slice(0, 5), end: b.closes.slice(0, 5) },
          ]),
        ) as OperatingHours,
        codes: (results[5].data ?? []).map((c) => c.code),
      },
      actor: { id: user.id, role: member.role },
      revision: Number(last.data.revision),
      team: (results[0].data ?? []).map((p) => ({
        id: p.id,
        name: p.display_name,
        role: p.employment_type,
        employmentType: p.employment_type,
      })),
      data: {
        version: 1,
        availability: (results[1].data ?? []).map((a) => ({
          id: a.id,
          employeeId: a.staff_id,
          dates: a.sos_availability_days
            .map((d: { day: string }) => d.day)
            .sort(),
          start: a.starts.slice(0, 5),
          end: a.finishes.slice(0, 5),
          allDay: a.all_day,
          branches: a.sos_availability_branches.map(
            (b: { branch: Branch }) => b.branch,
          ),
          submittedAt: a.submitted_at,
        })),
        shifts: (results[2].data ?? []).map((s) => ({
          id: s.id,
          employeeId: s.staff_id,
          date: s.day,
          start: s.starts.slice(0, 5),
          end: s.finishes.slice(0, 5),
          branch: s.branch,
          status: s.status,
        })),
        shItems: (results[3].data ?? []).map((h) => ({
          id: h.id,
          employeeId: h.staff_id,
          date: h.day,
          branch: h.branch,
          code: h.code,
          status: h.status,
        })),
      },
    };
  }
  throw new Error("The rota is changing. Synchronise again.");
}
