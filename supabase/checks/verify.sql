-- Claimline — post-migration self check.
--
-- Safe against a live project: everything runs inside a transaction that is
-- rolled back, so no rows survive. Results come back as a table rather than
-- as notices, because the Supabase SQL editor does not reliably show notices.
--
-- Every row should read PASS.

begin;

create temp table _checks (ord int, check_name text, result text) on commit drop;
grant all on _checks to authenticated;

insert into auth.users (id, email)
  values ('00000000-dead-beef-0000-000000000001', 'selfcheck@example.invalid');
insert into orgs (id, name) values
  ('00000000-dead-beef-0000-00000000000a', 'Self check A'),
  ('00000000-dead-beef-0000-00000000000b', 'Self check B');
insert into org_secrets (org_id) values
  ('00000000-dead-beef-0000-00000000000a'),
  ('00000000-dead-beef-0000-00000000000b');
insert into org_members values
  ('00000000-dead-beef-0000-00000000000a', '00000000-dead-beef-0000-000000000001', 'owner');
insert into clients (id, org_id, name) values
  ('00000000-dead-beef-0000-0000000000c1', '00000000-dead-beef-0000-00000000000a', 'Self check client');
insert into campaigns (id, org_id, client_id, name) values
  ('00000000-dead-beef-0000-0000000000d1', '00000000-dead-beef-0000-00000000000a',
   '00000000-dead-beef-0000-0000000000c1', 'Self check campaign');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-dead-beef-0000-000000000001';

do $$
declare
  org uuid := '00000000-dead-beef-0000-00000000000a';
  other uuid := '00000000-dead-beef-0000-00000000000b';
  camp uuid := '00000000-dead-beef-0000-0000000000d1';
begin
  -- 1. Phone normalisation. If this fails, sales logged with a country code
  -- never match their call and silently drop off the claim.
  if hash_phone(org, '5552129900') = hash_phone(org, '+1 (555) 212-9900')
     and hash_phone(org, '555-212-9900') = hash_phone(org, '1 555 212 9900')
     and hash_phone(org, '5552129900') <> hash_phone(org, '5552129901')
  then insert into _checks values (1, 'Phone formats normalise to one hash', 'PASS');
  else insert into _checks values (1, 'Phone formats normalise to one hash', 'FAIL');
  end if;

  -- 2. The salt is protected twice: no RLS policy and no table grant.
  -- Either refusal counts.
  begin
    if (select count(*) from org_secrets) = 0
    then insert into _checks values (2, 'Org salt unreadable', 'PASS (no rows visible)');
    else insert into _checks values (2, 'Org salt unreadable', 'FAIL readable');
    end if;
  exception when insufficient_privilege then
    insert into _checks values (2, 'Org salt unreadable', 'PASS (permission denied)');
  end;

  -- 3. Hashing on behalf of an org you do not belong to.
  if hash_phone(other, '5552129900') is null
  then insert into _checks values (3, 'hash_phone refuses a foreign org', 'PASS');
  else insert into _checks values (3, 'hash_phone refuses a foreign org', 'FAIL');
  end if;

  -- 4. Re-importing the same export must not bill a call twice.
  insert into call_events (org_id, campaign_id, external_ref, phone_hash, phone_last4,
                           call_at, disposition, transfer_sec)
    values (org, camp, 'SELFCHECK-1', 'h', '9900', now(), 'XFER', 252);
  begin
    insert into call_events (org_id, campaign_id, external_ref, phone_hash, phone_last4,
                             call_at, disposition, transfer_sec)
      values (org, camp, 'SELFCHECK-1', 'h', '9900', now(), 'XFER', 252);
    insert into _checks values (4, 'Duplicate import cannot double-bill', 'FAIL accepted twice');
  exception when unique_violation then
    insert into _checks values (4, 'Duplicate import cannot double-bill', 'PASS');
  end;

  -- 5. Tenant isolation on writes.
  begin
    insert into clients (org_id, name) values (other, 'should not exist');
    insert into _checks values (5, 'Cross-org write blocked', 'FAIL wrote to another org');
  exception when insufficient_privilege then
    insert into _checks values (5, 'Cross-org write blocked', 'PASS');
  end;

  -- 6. The audit log must survive its own owner.
  insert into audit_log (org_id, action, entity) values (org, 'selfcheck', 'none');
  begin
    update audit_log set action = 'tampered';
    insert into _checks values (6, 'Audit log cannot be edited', 'FAIL editable');
  exception when others then
    insert into _checks values (6, 'Audit log cannot be edited', 'PASS');
  end;
end $$;

reset role;

select check_name, result from _checks order by ord;

rollback;
