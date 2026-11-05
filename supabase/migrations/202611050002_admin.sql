begin;
-- Trusted SQL Editor/admin-only onboarding. Never callable by anon or authenticated.
create function public.sos_admin_create_organisation(organisation_name text) returns uuid language plpgsql security definer set search_path='' as $$declare org uuid;begin
 insert into public.sos_organisations(name) values(organisation_name) returning id into org;
 insert into public.sos_revisions(org_id) values(org);
 insert into public.sos_branches values(org,'ST','08:00','20:00'),(org,'CSW','08:00','20:00'),(org,'SOHO W','09:00','22:00');
 insert into public.sos_sh_codes select org,'SH'||lpad(n::text,2,'0') from generate_series(1,12) n;
 return org;end$$;
create function public.sos_admin_provision_member(organisation_id uuid,auth_user_id uuid,staff_name text,employment text,staff_role text default 'STAFF') returns void language plpgsql security definer set search_path='' as $$begin
 if staff_role not in ('STAFF','MANAGER') or employment not in ('full-time','part-time') then raise exception 'Invalid role or employment';end if;
 insert into public.sos_memberships(user_id,org_id,role,active) values(auth_user_id,organisation_id,staff_role,true);
 insert into public.sos_profiles(id,org_id,display_name,employment_type) values(auth_user_id,organisation_id,staff_name,employment);
 end$$;
revoke all on function public.sos_admin_create_organisation(text),public.sos_admin_provision_member(uuid,uuid,text,text,text) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
