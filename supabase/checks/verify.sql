-- Claimline — post-migration self check.
-- Safe to run on a live project: everything happens inside a transaction that
-- is rolled back at the end, so no rows survive. Run it in the Supabase SQL
-- editor after 0001 and 0002. Every line should say PASS.

begin;

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
declare org uuid := '00000000-dead-beef-0000-00000000000a';
begin
  -- 1. phone normalisation
  if hash_phone(org, '5552129900') = hash_phone(org, '+1 (555) 212-9900')
     and hash_phone(org, '555-212-9900') = hash_phone(org, '1 555 212 9900')
     and hash_phone(org, '5552129900') <> hash_phone(org, '5552129901')
  then raise notice 'PASS  phone formats normalise to one hash';
  else raise notice 'FAIL  phone normalisation is wrong';
  end if;

  -- 2. the salt is unreachable
  if (select count(*) from org_secrets) = 0
  then raise notice 'PASS  org salt is unreadable';
  else raise notice 'FAIL  org salt is readable by a client role';
  end if;

  -- 3. hashing for an org you do not belong to
  if hash_phone('00000000-dead-beef-0000-00000000000b', '5552129900') is null
  then raise notice 'PASS  hash_phone refuses a foreign org';
  else raise notice 'FAIL  hash_phone served a foreign org';
  end if;

  -- 4. duplicate import protection
  insert into call_events (org_id, campaign_id, external_ref, phone_hash, phone_last4,
                           call_at, disposition, transfer_sec)
    values (org, '00000000-dead-beef-0000-0000000000d1', 'SELFCHECK-1', 'h', '9900',
            now(), 'XFER', 252);
  begin
    insert into call_events (org_id, campaign_id, external_ref, phone_hash, phone_last4,
                             call_at, disposition, transfer_sec)
      values (org, '00000000-dead-beef-0000-0000000000d1', 'SELFCHECK-1', 'h', '9900',
              now(), 'XFER', 252);
    raise notice 'FAIL  the same call could be imported twice';
  exception when unique_violation then
    raise notice 'PASS  re-importing a call cannot double-bill';
  end;

  -- 5. cross-org write
  begin
    insert into clients (org_id, name)
      values ('00000000-dead-beef-0000-00000000000b', 'should not exist');
    raise notice 'FAIL  wrote into another organisation';
  exception when insufficient_privilege then
    raise notice 'PASS  cross-org write blocked by RLS';
  end;

  -- 6. audit log immutability
  insert into audit_log (org_id, action, entity) values (org, 'selfcheck', 'none');
  begin
    update audit_log set action = 'tampered';
    raise notice 'FAIL  audit log is editable';
  exception when others then
    raise notice 'PASS  audit log cannot be edited';
  end;
end $$;

rollback;
