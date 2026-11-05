import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
try {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await readFile("supabase/migrations/202611050001_sos.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/migrations/202611050002_admin.sql", "utf8"),
  );
  console.log(
    "PASS migration executes with auto table grants absent and RLS enabled.",
  );
  const ids = {
    org: "10000000-0000-4000-8000-000000000001",
    other: "10000000-0000-4000-8000-000000000002",
    manager: "20000000-0000-4000-8000-000000000001",
    alex: "20000000-0000-4000-8000-000000000002",
    jamie: "20000000-0000-4000-8000-000000000003",
    foreign: "20000000-0000-4000-8000-000000000004",
    outsider: "20000000-0000-4000-8000-000000000005",
  };
  await db.exec(
    `insert into auth.users values ${Object.values(ids)
      .slice(2)
      .map((id) => `('${id}')`)
      .join(
        ",",
      )};insert into public.sos_organisations values ('${ids.org}','Test cafés'),('${ids.other}','Other café');insert into public.sos_revisions(org_id) values('${ids.org}'),('${ids.other}');`,
  );
  for (const [person, role, org] of [
    ["manager", "MANAGER", ids.org],
    ["alex", "STAFF", ids.org],
    ["jamie", "STAFF", ids.org],
    ["foreign", "STAFF", ids.other],
  ]) {
    await db.query(
      "insert into public.sos_memberships(user_id,org_id,role) values ($1,$2,$3)",
      [ids[person], org, role],
    );
    await db.query("insert into public.sos_profiles values ($1,$2,$3,$4)", [
      ids[person],
      org,
      person,
      "full-time",
    ]);
  }
  for (const org of [ids.org, ids.other])
    await db.exec(
      `insert into public.sos_branches values ('${org}','ST','08:00','20:00'),('${org}','CSW','08:00','20:00'),('${org}','SOHO W','09:00','22:00');insert into public.sos_sh_codes select '${org}', 'SH'||lpad(i::text,2,'0') from generate_series(1,12) i;`,
    );
  const as = async (user, sql, params = []) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      ids[user] ?? "",
    ]);
    await db.exec(`set role ${user === "anon" ? "anon" : "authenticated"}`);
    return db.query(sql, params);
  };
  let checks = 0;
  const reject = async (p, regex) => {
    await assert.rejects(p, regex);
    checks++;
  };
  const rev = async (user) =>
    (await as(user, "select revision from public.sos_revisions")).rows[0]
      .revision;
  const apply = async (user, changes, revision) =>
    as(user, "select public.sos_apply_changes($1,$2::jsonb)", [
      revision ?? (await rev(user)),
      JSON.stringify(changes),
    ]);
  const availability = {
    id: "30000000-0000-4000-8000-000000000001",
    employeeId: ids.alex,
    dates: ["2026-11-09", "2026-11-10"],
    start: "09:00",
    end: "18:00",
    allDay: false,
    branches: ["ST", "CSW"],
  };
  await apply("alex", [
    { kind: "availability", action: "upsert", record: availability },
  ]);
  checks++;
  assert.equal(
    (await as("jamie", "select * from public.sos_availability")).rows.length,
    1,
  );
  checks++;
  assert.equal(
    (await as("foreign", "select * from public.sos_availability")).rows.length,
    0,
  );
  checks++;
  await reject(
    as("anon", "select * from public.sos_availability"),
    /permission denied/,
  );
  assert.equal(
    (await as("outsider", "select * from public.sos_profiles")).rows.length,
    0,
  );
  checks++;
  await reject(
    apply("jamie", [
      {
        kind: "availability",
        action: "upsert",
        record: { ...availability, start: "10:00" },
      },
    ]),
    /Only the owner/,
  );
  await reject(
    apply("manager", [
      { kind: "availability", action: "delete", record: availability },
    ]),
    /Only the owner/,
  );
  await reject(
    as(
      "alex",
      "update public.sos_memberships set role='MANAGER' where user_id=$1",
      [ids.alex],
    ),
    /permission denied/,
  );
  await reject(
    as(
      "alex",
      "update public.sos_profiles set display_name='Impersonation' where id=$1",
      [ids.jamie],
    ),
    /permission denied/,
  );
  const ownJamie = {
    ...availability,
    id: "30000000-0000-4000-8000-000000000002",
    employeeId: ids.jamie,
    dates: ["2026-11-11"],
  };
  await apply("jamie", [
    { kind: "availability", action: "upsert", record: ownJamie },
  ]);
  assert.equal(
    (await as("alex", "select * from public.sos_availability")).rows.length,
    2,
  );
  checks++;
  await apply("jamie", [
    {
      kind: "availability",
      action: "upsert",
      record: { ...ownJamie, start: "10:00" },
    },
  ]);
  assert.equal(
    (
      await as(
        "jamie",
        "select starts from public.sos_availability where staff_id=$1",
        [ids.jamie],
      )
    ).rows[0].starts,
    "10:00:00",
  );
  checks++;
  await apply("jamie", [
    { kind: "availability", action: "delete", record: ownJamie },
  ]);
  assert.equal(
    (await as("alex", "select * from public.sos_availability")).rows.length,
    1,
  );
  checks++;
  const shift = {
    id: "40000000-0000-4000-8000-000000000001",
    employeeId: ids.alex,
    date: "2026-11-09",
    start: "11:00",
    end: "17:00",
    branch: "ST",
    status: "draft",
  };
  await reject(
    apply("alex", [{ kind: "shift", action: "upsert", record: shift }]),
    /Manager role/,
  );
  await apply("manager", [{ kind: "shift", action: "upsert", record: shift }]);
  checks++;
  assert.equal(
    (await as("alex", "select * from public.sos_shifts")).rows.length,
    0,
  );
  checks++;
  assert.equal(
    (await as("jamie", "select * from public.sos_availability_days")).rows
      .length,
    2,
  );
  checks++;
  await reject(
    apply("manager", [
      {
        kind: "shift",
        action: "upsert",
        record: {
          ...shift,
          id: "40000000-0000-4000-8000-000000000002",
          branch: "CSW",
          start: "12:00",
        },
      },
    ]),
    /Overlapping/,
  );
  await reject(
    apply("manager", [
      { kind: "shift", action: "upsert", record: { ...shift, start: "08:00" } },
    ]),
    /availability interval/,
  );
  await reject(
    apply("manager", [
      {
        kind: "shift",
        action: "upsert",
        record: { ...shift, branch: "SOHO W" },
      },
    ]),
    /availability interval/,
  );
  await reject(
    apply("alex", [
      { kind: "availability", action: "delete", record: availability },
    ]),
    /availability interval/,
  );
  assert.equal(
    (await as("alex", "select * from public.sos_availability")).rows.length,
    1,
  );
  checks++;
  const sh = {
    id: "50000000-0000-4000-8000-000000000001",
    employeeId: ids.alex,
    date: "2026-11-10",
    branch: "CSW",
    code: "SH02",
    status: "draft",
  };
  await apply("manager", [{ kind: "holiday", action: "upsert", record: sh }]);
  checks++;
  await reject(
    apply("manager", [
      {
        kind: "holiday",
        action: "upsert",
        record: { ...sh, date: "2026-11-09" },
      },
    ]),
    /SH conflicts/,
  );
  await reject(
    as("alex", "select public.sos_publish_month($1,$2)", [
      "2026-11-01",
      await rev("alex"),
    ]),
    /Manager role/,
  );
  await as("manager", "select public.sos_publish_month($1,$2)", [
    "2026-11-01",
    await rev("manager"),
  ]);
  checks++;
  assert.equal(
    (await as("jamie", "select * from public.sos_shifts")).rows.length,
    1,
  );
  assert.equal(
    (await as("jamie", "select * from public.sos_sh_items")).rows.length,
    1,
  );
  checks++;
  assert.equal(
    (await as("jamie", "select * from public.sos_availability")).rows.length,
    1,
  );
  checks++;
  await reject(
    apply("manager", [{ kind: "shift", action: "delete", record: shift }], 0),
    /Synchronise/,
  );
  // A later operation failure rolls back earlier operations in the same RPC.
  await reject(
    apply("manager", [
      { kind: "shift", action: "delete", record: shift },
      {
        kind: "shift",
        action: "upsert",
        record: {
          ...shift,
          id: "40000000-0000-4000-8000-000000000002",
          branch: "SOHO W",
        },
      },
    ]),
    /availability interval/,
  );
  assert.equal(
    (await as("jamie", "select * from public.sos_shifts")).rows.length,
    1,
  );
  checks++;
  // Direct REST-style writes still hit RLS/triggers, not just application RPCs.
  await reject(
    as(
      "alex",
      "insert into public.sos_shifts(id,org_id,staff_id,day,starts,finishes,branch,status) values(gen_random_uuid(),$1,$2,'2026-11-10','10:00','11:00','ST','draft')",
      [ids.org, ids.alex],
    ),
    /row-level security|Manager role/,
  );
  await reject(
    as(
      "manager",
      "insert into public.sos_shifts(id,org_id,staff_id,day,starts,finishes,branch,status) values(gen_random_uuid(),$1,$2,'2026-11-09','09:00','10:00','ST','draft')",
      [ids.other, ids.foreign],
    ),
    /row-level security|Organisation denied|Manager role/,
  );
  await db.exec("reset role");
  const exposed = await db.query(
    "select relname,relrowsecurity from pg_class where relname like 'sos_%' and relkind='r'",
  );
  assert.ok(exposed.rows.every((r) => r.relrowsecurity));
  checks++;
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','public.sos_apply_changes(bigint,jsonb)','execute') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  checks++;
  assert.equal(
    (
      await db.query(
        "select has_table_privilege('authenticated','public.sos_memberships','update') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  checks++;
  await reject(
    as("alex", "select public.sos_admin_create_organisation('Unauthorised')"),
    /permission denied/,
  );
  // RLS does not replace GRANT: the same permitted SELECT fails without its table grant.
  await db.exec(
    "reset role; revoke select on public.sos_availability from authenticated",
  );
  await reject(
    as("alex", "select * from public.sos_availability"),
    /permission denied/,
  );
  await db.exec(
    "reset role; grant select on public.sos_availability to authenticated",
  );
  assert.equal(
    (await as("alex", "select * from public.sos_availability")).rows.length,
    1,
  );
  checks++;
  await reject(
    as("alex", "update public.sos_availability set submitted_at=now()"),
    /permission denied/,
  );
  await reject(
    as("alex", "update public.sos_availability_days set day='2026-11-12'"),
    /permission denied/,
  );
  await db.exec(
    "reset role; select set_config('request.jwt.claim.sub','',false)",
  );
  const created = (
    await db.query(
      "select public.sos_admin_create_organisation('Provisioning test') id",
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.sos_branches where org_id=$1",
        [created],
      )
    ).rows[0].n,
    3,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.sos_sh_codes where org_id=$1",
        [created],
      )
    ).rows[0].n,
    12,
  );
  checks++;
  const newUser = "20000000-0000-4000-8000-000000000006";
  await db.query("insert into auth.users values($1)", [newUser]);
  await db.query(
    "select public.sos_admin_provision_member($1,$2,'Invited Test','full-time','STAFF')",
    [created, newUser],
  );
  assert.equal(
    (
      await db.query(
        "select role from public.sos_memberships where user_id=$1",
        [newUser],
      )
    ).rows[0].role,
    "STAFF",
  );
  checks++;
  console.log(
    `PASS ${checks} PostgreSQL GRANT/RLS/trigger/RPC checks: one manager, two staff, second organisation, anonymous and unapproved users. Actual Supabase Auth and network concurrency require project configuration.`,
  );
} finally {
  await db.close();
}
