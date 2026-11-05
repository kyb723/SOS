begin;
-- Apply as the database owner, before enabling the authenticated application.
-- No default table exposure is assumed. No grants are made to anon.
create schema sos_private;
revoke all on schema sos_private from public, anon, authenticated;
create table public.sos_organisations(id uuid primary key default gen_random_uuid(), name text not null);
create table public.sos_memberships(user_id uuid primary key references auth.users(id), org_id uuid not null references public.sos_organisations(id), role text not null check(role in ('STAFF','MANAGER')), active boolean not null default true, unique(org_id,user_id));
create table public.sos_profiles(id uuid primary key references auth.users(id), org_id uuid not null, display_name text not null check(length(display_name) between 1 and 80), employment_type text not null check(employment_type in ('full-time','part-time')), unique(org_id,id), foreign key(org_id,id) references public.sos_memberships(org_id,user_id));
create table public.sos_branches(org_id uuid not null references public.sos_organisations(id), code text not null check(code in ('ST','CSW','SOHO W')), opens time not null, closes time not null, check(opens<closes),primary key(org_id,code));
create table public.sos_sh_codes(org_id uuid not null references public.sos_organisations(id), code text not null check(code ~ '^SH[0-9]{2,3}$'),primary key(org_id,code));
create table public.sos_availability(id uuid primary key default gen_random_uuid(), org_id uuid not null, staff_id uuid not null, starts time not null, finishes time not null, all_day boolean not null, submitted_at timestamptz not null default now(),check(starts<finishes),unique(id,org_id),unique(id,org_id,staff_id),foreign key(org_id,staff_id) references public.sos_profiles(org_id,id));
create table public.sos_availability_days(submission_id uuid not null,org_id uuid not null,staff_id uuid not null,day date not null,primary key(submission_id,day),unique(org_id,staff_id,day),foreign key(submission_id,org_id,staff_id) references public.sos_availability(id,org_id,staff_id) on delete cascade);
create table public.sos_availability_branches(submission_id uuid not null,org_id uuid not null,branch text not null,primary key(submission_id,branch),foreign key(submission_id,org_id) references public.sos_availability(id,org_id) on delete cascade,foreign key(org_id,branch) references public.sos_branches(org_id,code));
create table public.sos_shifts(id uuid primary key default gen_random_uuid(),org_id uuid not null,staff_id uuid not null,day date not null,starts time not null,finishes time not null,branch text not null,status text not null check(status in ('draft','published')),check(starts<finishes),foreign key(org_id,staff_id) references public.sos_profiles(org_id,id),foreign key(org_id,branch) references public.sos_branches(org_id,code));
create table public.sos_sh_items(id uuid primary key default gen_random_uuid(),org_id uuid not null,staff_id uuid not null,day date not null,branch text not null,code text not null,status text not null check(status in ('draft','published')),unique(org_id,staff_id,day),foreign key(org_id,staff_id) references public.sos_profiles(org_id,id),foreign key(org_id,branch) references public.sos_branches(org_id,code),foreign key(org_id,code) references public.sos_sh_codes(org_id,code));
create table public.sos_publications(id uuid primary key default gen_random_uuid(),org_id uuid not null references public.sos_organisations(id),month date not null check(extract(day from month)=1),published_by uuid not null references auth.users(id),published_at timestamptz not null default now(),item_count integer not null);
create table public.sos_revisions(org_id uuid primary key references public.sos_organisations(id),revision bigint not null default 0);

create function sos_private.org_id() returns uuid language sql stable security definer set search_path='' as $$select org_id from public.sos_memberships where user_id=auth.uid() and active$$;
create function sos_private.manager() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.sos_memberships where user_id=auth.uid() and active and role='MANAGER')$$;
-- All schedule writes (including direct Data API writes) lock the organisation row.
create function sos_private.bump_revision() returns trigger language plpgsql security definer set search_path='' as $$declare org uuid;begin org:=case when TG_OP='DELETE' then old.org_id else new.org_id end; if auth.uid() is not null and org is distinct from sos_private.org_id() then raise exception 'Organisation denied';end if; update public.sos_revisions set revision=revision+1 where org_id=org; if not found then raise exception 'Organisation revision is not initialised';end if;return case when TG_OP='DELETE' then old else new end;end$$;
create function sos_private.check_shift(s public.sos_shifts) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.sos_availability a join public.sos_availability_days d on d.submission_id=a.id join public.sos_availability_branches ab on ab.submission_id=a.id join public.sos_branches b on b.org_id=ab.org_id and b.code=ab.branch where a.org_id=s.org_id and a.staff_id=s.staff_id and d.day=s.day and ab.branch=s.branch and s.starts>=case when a.all_day then b.opens else a.starts end and s.finishes<=case when a.all_day then b.closes else a.finishes end) then raise exception 'Shift must fit one submitted availability interval and permitted branch';end if;
 if exists(select 1 from public.sos_shifts x where x.org_id=s.org_id and x.staff_id=s.staff_id and x.day=s.day and x.id<>s.id and x.starts<s.finishes and s.starts<x.finishes) then raise exception 'Overlapping working shift across branches';end if;
 if exists(select 1 from public.sos_sh_items h where h.org_id=s.org_id and h.staff_id=s.staff_id and h.day=s.day) then raise exception 'SH conflicts with working shift';end if;
end$$;
create function sos_private.validate_shift() returns trigger language plpgsql security definer set search_path='' as $$begin if auth.uid() is not null and (new.org_id is distinct from sos_private.org_id() or not sos_private.manager()) then raise exception 'Manager role required';end if;perform sos_private.check_shift(new);return new;end$$;
create function sos_private.validate_sh() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null and (new.org_id is distinct from sos_private.org_id() or not sos_private.manager()) then raise exception 'Manager role required';end if;
 if not exists(select 1 from public.sos_profiles p where p.id=new.staff_id and p.org_id=new.org_id and p.employment_type='full-time') then raise exception 'SH requires full-time employment';end if;
 if exists(select 1 from public.sos_shifts s where s.org_id=new.org_id and s.staff_id=new.staff_id and s.day=new.day) then raise exception 'SH conflicts with working shift';end if;return new;end$$;
-- Deferred until the RPC has finished replacing date/branch child rows.
create function sos_private.check_availability_integrity() returns trigger language plpgsql security definer set search_path='' as $$declare org uuid; a public.sos_availability; s public.sos_shifts;begin
 org:=case when TG_OP='DELETE' then old.org_id else new.org_id end;
 for a in select * from public.sos_availability where org_id=org loop
 if not exists(select 1 from public.sos_availability_days where submission_id=a.id) or not exists(select 1 from public.sos_availability_branches where submission_id=a.id) then raise exception 'Availability requires dates and branches';end if;end loop;
 for s in select * from public.sos_shifts where org_id=org loop perform sos_private.check_shift(s);end loop;return null;end$$;

-- Explicit RLS on every exposed relation, even when automatic RLS is enabled.
do $$declare t text;begin foreach t in array array['sos_organisations','sos_memberships','sos_profiles','sos_branches','sos_sh_codes','sos_availability','sos_availability_days','sos_availability_branches','sos_shifts','sos_sh_items','sos_publications','sos_revisions'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
create policy organisation_read on public.sos_organisations for select to authenticated using(id=sos_private.org_id());
create policy membership_read on public.sos_memberships for select to authenticated using(user_id=auth.uid() and active);
create policy profiles_team_read on public.sos_profiles for select to authenticated using(org_id=sos_private.org_id());
create policy branches_team_read on public.sos_branches for select to authenticated using(org_id=sos_private.org_id());
create policy codes_team_read on public.sos_sh_codes for select to authenticated using(org_id=sos_private.org_id());
create policy availability_team_read on public.sos_availability for select to authenticated using(org_id=sos_private.org_id());
create policy availability_own_insert on public.sos_availability for insert to authenticated with check(org_id=sos_private.org_id() and staff_id=auth.uid());
create policy availability_own_update on public.sos_availability for update to authenticated using(org_id=sos_private.org_id() and staff_id=auth.uid()) with check(org_id=sos_private.org_id() and staff_id=auth.uid());
create policy availability_own_delete on public.sos_availability for delete to authenticated using(org_id=sos_private.org_id() and staff_id=auth.uid());
do $$declare t text;begin foreach t in array array['sos_availability_days','sos_availability_branches'] loop
 execute format('create policy team_read on public.%I for select to authenticated using(org_id=sos_private.org_id())',t);
 execute format('create policy own_write on public.%I for all to authenticated using(org_id=sos_private.org_id() and exists(select 1 from public.sos_availability a where a.id=submission_id and a.staff_id=auth.uid())) with check(org_id=sos_private.org_id() and exists(select 1 from public.sos_availability a where a.id=submission_id and a.staff_id=auth.uid()))',t);
end loop;end$$;
do $$declare t text;begin foreach t in array array['sos_shifts','sos_sh_items'] loop
 execute format('create policy rota_read on public.%I for select to authenticated using(org_id=sos_private.org_id() and (status=''published'' or sos_private.manager()))',t);
 execute format('create policy manager_write on public.%I for all to authenticated using(org_id=sos_private.org_id() and sos_private.manager()) with check(org_id=sos_private.org_id() and sos_private.manager())',t);
end loop;end$$;
create policy publications_read on public.sos_publications for select to authenticated using(org_id=sos_private.org_id());
create policy revisions_read on public.sos_revisions for select to authenticated using(org_id=sos_private.org_id());

-- Critical: explicitly revoke any automatic/default API grants, then grant only what is used.
do $$declare t text;begin foreach t in array array['sos_organisations','sos_memberships','sos_profiles','sos_branches','sos_sh_codes','sos_availability','sos_availability_days','sos_availability_branches','sos_shifts','sos_sh_items','sos_publications','sos_revisions'] loop execute format('revoke all on table public.%I from public, anon, authenticated',t);end loop;end$$;
grant usage on schema public to authenticated;
grant select on public.sos_organisations,public.sos_memberships,public.sos_profiles,public.sos_branches,public.sos_sh_codes,public.sos_availability,public.sos_availability_days,public.sos_availability_branches,public.sos_shifts,public.sos_sh_items,public.sos_publications,public.sos_revisions to authenticated;
grant insert(id,org_id,staff_id,starts,finishes,all_day),update(starts,finishes,all_day),delete on public.sos_availability to authenticated;
grant insert,delete on public.sos_availability_days,public.sos_availability_branches to authenticated;
grant insert(id,org_id,staff_id,day,starts,finishes,branch,status),update(staff_id,day,starts,finishes,branch,status),delete on public.sos_shifts to authenticated;
grant insert(id,org_id,staff_id,day,branch,code,status),update(staff_id,day,branch,code,status),delete on public.sos_sh_items to authenticated;
-- Helpers are not in an exposed schema. No execute permission on trigger/check internals.
revoke all on all functions in schema sos_private from public,anon,authenticated;
grant usage on schema sos_private to authenticated;
grant execute on function sos_private.org_id(),sos_private.manager() to authenticated;

do $$declare t text;begin foreach t in array array['sos_availability','sos_availability_days','sos_availability_branches','sos_shifts','sos_sh_items','sos_branches','sos_sh_codes','sos_profiles','sos_memberships'] loop
 execute format('create trigger a_revision before insert or update or delete on public.%I for each row execute function sos_private.bump_revision()',t);
end loop;
foreach t in array array['sos_availability','sos_availability_days','sos_availability_branches'] loop execute format('create constraint trigger availability_integrity after insert or update or delete on public.%I deferrable initially deferred for each row execute function sos_private.check_availability_integrity()',t);end loop;end$$;
create trigger b_shift_integrity before insert or update on public.sos_shifts for each row execute function sos_private.validate_shift();
create trigger b_sh_integrity before insert or update on public.sos_sh_items for each row execute function sos_private.validate_sh();

create function public.sos_apply_changes(expected_revision bigint,changes jsonb) returns bigint language plpgsql security invoker set search_path='' as $$declare org uuid:=sos_private.org_id(); current_revision bigint; op jsonb;r jsonb;key uuid;kind text;begin
 if org is null then raise exception 'Active organisation membership required';end if;
 -- Definer helper performs the private lock; invoker DML below still uses RLS.
 current_revision:=sos_private.lock_revision(org);
 if current_revision<>expected_revision then raise exception 'Schedule changed. Synchronise and retry';end if;
 if changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>500 then raise exception 'Invalid changes';end if;
 for op in select * from jsonb_array_elements(changes) loop
 r:=op->'record';key:=(r->>'id')::uuid;kind:=op->>'kind';
 if coalesce(op->>'action','') not in ('delete','upsert') or coalesce(kind,'') not in ('availability','shift','holiday') then raise exception 'Invalid operation';end if;
 if kind='availability' then
 if (r->>'employeeId')::uuid<>auth.uid() then raise exception 'Only the owner can change availability, including managers';end if;
 if op->>'action'='delete' then delete from public.sos_availability where id=key and staff_id=auth.uid();
 else
 insert into public.sos_availability(id,org_id,staff_id,starts,finishes,all_day) values(key,org,auth.uid(),case when (r->>'allDay')::boolean then '00:00'::time else (r->>'start')::time end,case when (r->>'allDay')::boolean then '23:59'::time else (r->>'end')::time end,(r->>'allDay')::boolean) on conflict(id) do update set starts=excluded.starts,finishes=excluded.finishes,all_day=excluded.all_day;
 delete from public.sos_availability_days where submission_id=key;
 delete from public.sos_availability_branches where submission_id=key;
 insert into public.sos_availability_days select key,org,auth.uid(),value::date from jsonb_array_elements_text(r->'dates');
 insert into public.sos_availability_branches select key,org,value from jsonb_array_elements_text(r->'branches');
 end if;
 elsif kind='shift' then
 if not sos_private.manager() then raise exception 'Manager role required';end if;
 if op->>'action'='delete' then delete from public.sos_shifts where id=key;
 else insert into public.sos_shifts(id,org_id,staff_id,day,starts,finishes,branch,status) values(key,org,(r->>'employeeId')::uuid,(r->>'date')::date,(r->>'start')::time,(r->>'end')::time,r->>'branch',r->>'status') on conflict(id) do update set staff_id=excluded.staff_id,day=excluded.day,starts=excluded.starts,finishes=excluded.finishes,branch=excluded.branch,status=excluded.status;end if;
 else
 if not sos_private.manager() then raise exception 'Manager role required';end if;
 if op->>'action'='delete' then delete from public.sos_sh_items where id=key;
 else insert into public.sos_sh_items(id,org_id,staff_id,day,branch,code,status) values(key,org,(r->>'employeeId')::uuid,(r->>'date')::date,r->>'branch',r->>'code',r->>'status') on conflict(id) do update set staff_id=excluded.staff_id,day=excluded.day,branch=excluded.branch,code=excluded.code,status=excluded.status;end if;
 end if;end loop;
 return (select revision from public.sos_revisions where org_id=org);
end$$;
-- Revision table is read-only to clients; helpers verify org and manager before any privileged action.
create function sos_private.lock_revision(org uuid) returns bigint language plpgsql security definer set search_path='' as $$declare r bigint;begin if org is distinct from sos_private.org_id() then raise exception 'Organisation denied';end if;select revision into strict r from public.sos_revisions where org_id=org for update;return r;end$$;
grant execute on function sos_private.lock_revision(uuid) to authenticated;
create function public.sos_publish_month(month_start date,expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$declare org uuid:=sos_private.org_id();r bigint;s public.sos_shifts;h public.sos_sh_items;n integer;begin
 if org is null or not sos_private.manager() then raise exception 'Manager role required';end if;
 if extract(day from month_start)<>1 then raise exception 'Use the first day of the month';end if;
 r:=sos_private.lock_revision(org);if r<>expected_revision then raise exception 'Schedule changed. Synchronise and retry';end if;
 for s in select * from public.sos_shifts where org_id=org and status='draft' and day>=month_start and day<(month_start+interval '1 month')::date loop perform sos_private.check_shift(s);end loop;
 -- SH table constraints and validation triggers also run on publication.
 select (select count(*) from public.sos_shifts where org_id=org and status='draft' and day>=month_start and day<(month_start+interval '1 month')::date)+(select count(*) from public.sos_sh_items where org_id=org and status='draft' and day>=month_start and day<(month_start+interval '1 month')::date) into n;
 update public.sos_shifts set status='published' where org_id=org and status='draft' and day>=month_start and day<(month_start+interval '1 month')::date;
 update public.sos_sh_items set status='published' where org_id=org and status='draft' and day>=month_start and day<(month_start+interval '1 month')::date;
 insert into public.sos_publications(org_id,month,published_by,item_count) values(org,month_start,auth.uid(),n);
 return (select revision from public.sos_revisions where org_id=org);
end$$;
revoke all on function public.sos_apply_changes(bigint,jsonb),public.sos_publish_month(date,bigint) from public,anon,authenticated;
grant execute on function public.sos_apply_changes(bigint,jsonb),public.sos_publish_month(date,bigint) to authenticated;
revoke all on function sos_private.lock_revision(uuid) from public,anon;
notify pgrst, 'reload schema';
commit;
