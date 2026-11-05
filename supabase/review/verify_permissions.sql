-- REVIEW FILE ONLY. Not executed against any remote database by this task.
-- Run after approved migrations have been applied, using the trusted SQL Editor.
-- Read-only catalog checks; these do not replace signed-in RLS acceptance tests.
begin read only;

-- Expected: RLS is true and anon SELECT is false on every SOS table.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'sos_%' and c.relkind = 'r'
order by c.relname;

-- Expected: starts / finishes / all_day can be updated; ownership / timestamp cannot.
select column_name,
       has_column_privilege('authenticated', 'public.sos_availability', column_name, 'INSERT') as can_insert_column,
       has_column_privilege('authenticated', 'public.sos_availability', column_name, 'UPDATE') as can_update_column
from information_schema.columns
where table_schema = 'public' and table_name = 'sos_availability'
order by ordinal_position;

-- Expected: false for all privileged table writes below.
select table_name, permission,
       has_table_privilege('authenticated', 'public.' || table_name, permission) as allowed
from (values ('sos_memberships','UPDATE'), ('sos_profiles','UPDATE'),
             ('sos_revisions','UPDATE'), ('sos_publications','INSERT'),
             ('sos_branches','UPDATE'), ('sos_sh_codes','UPDATE')) as checks(table_name, permission);

-- Expected: authenticated EXECUTE for the two application RPCs only;
-- false for admin provisioning functions. Anon EXECUTE is always false.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig as function_settings,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'sos_%'
order by p.proname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename like 'sos_%'
order by tablename, policyname;
commit;
