-- Claimline 0002 — row level security
-- Isolation lives in the database, not in application code. A bug in a query
-- must not be able to return another organisation's rows.

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any(p_roles)
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- Enable RLS everywhere. Default deny: a table with RLS on and no policy
-- returns nothing, which is the behaviour we want if a policy is forgotten.
alter table orgs                enable row level security;
alter table org_members         enable row level security;
alter table org_secrets         enable row level security;
alter table clients             enable row level security;
alter table campaigns           enable row level security;
alter table rate_cards          enable row level security;
alter table column_mappings     enable row level security;
alter table import_batches      enable row level security;
alter table call_events         enable row level security;
alter table sale_events         enable row level security;
alter table claims              enable row level security;
alter table billable_items      enable row level security;
alter table payments            enable row level security;
alter table payment_allocations enable row level security;
alter table exceptions          enable row level security;
alter table audit_log           enable row level security;

-- org_secrets gets NO policy at all. Nothing reachable by a client role can
-- read the salt; only security-definer functions can.
revoke all on org_secrets from anon, authenticated;

create policy org_read on orgs
  for select to authenticated using (is_org_member(id));

create policy member_read on org_members
  for select to authenticated using (is_org_member(org_id));
create policy member_write on org_members
  for all to authenticated
  using (has_org_role(org_id, array['owner']))
  with check (has_org_role(org_id, array['owner']));

-- Everything an org owns: readable by any member, writable by working roles.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','campaigns','rate_cards','column_mappings','import_batches',
    'call_events','sale_events','claims','billable_items','payments',
    'payment_allocations','exceptions'
  ]
  loop
    execute format(
      'create policy %1$s_read on %1$s for select to authenticated
         using (is_org_member(org_id));', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated
         using (has_org_role(org_id, array[''owner'',''manager'',''finance'']))
         with check (has_org_role(org_id, array[''owner'',''manager'',''finance'']));', t);
  end loop;
end $$;

-- The audit log is append only. Even an owner cannot rewrite history.
create policy audit_read on audit_log
  for select to authenticated using (is_org_member(org_id));
create policy audit_append on audit_log
  for insert to authenticated with check (is_org_member(org_id));
revoke update, delete on audit_log from authenticated, anon;
