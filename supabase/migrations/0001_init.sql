-- Claimline 0001 — schema
-- Money is integer cents everywhere. Phone numbers are never stored in the clear.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tenancy

create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table org_members (
  org_id   uuid not null references orgs(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     text not null check (role in ('owner','manager','finance','viewer')),
  added_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Per-org HMAC salt. No client role may ever read this table.
create table org_secrets (
  org_id     uuid primary key references orgs(id) on delete cascade,
  phone_salt text not null default encode(extensions.gen_random_bytes(32), 'hex')
);

-- ---------------------------------------------------------------- commercial setup

create table clients (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references orgs(id) on delete cascade,
  name                text not null,
  currency            char(3) not null default 'USD',
  payment_terms_days  int not null default 30,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table campaigns (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  name       text not null,
  vertical   text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Never edited in place. "What was the rate on 16 Oct" must always be answerable.
create table rate_cards (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references orgs(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete cascade,
  unit_type           text not null check (unit_type in ('transfer','sale')),
  rate_cents          int  not null check (rate_cents >= 0),
  min_duration_sec    int  not null default 0 check (min_duration_sec >= 0),
  qualifying_statuses text[] not null default '{}',
  effective_from      date not null,
  effective_to        date,
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id),
  check (effective_to is null or effective_to >= effective_from)
);

-- ---------------------------------------------------------------- imported facts

create table column_mappings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  source     text not null check (source in ('calls','sales','payments')),
  name       text not null,
  mapping    jsonb not null,
  created_at timestamptz not null default now(),
  unique (org_id, source, name)
);

create table import_batches (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  source       text not null check (source in ('calls','sales','payments')),
  filename     text not null,
  row_count    int  not null default 0,
  period_start date,
  period_end   date,
  checksum     text,
  imported_by  uuid references auth.users(id),
  imported_at  timestamptz not null default now()
);

create table call_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  batch_id      uuid references import_batches(id) on delete set null,
  external_ref  text not null,            -- VICIdial uniqueid
  lead_ref      text,                     -- VICIdial lead_id
  phone_hash    text not null,
  phone_last4   char(4),
  call_at       timestamptz not null,
  agent_code    text,
  disposition   text not null,
  talk_sec      int not null default 0,
  transfer_sec  int not null default 0,
  recording_ref text,                     -- filename only. Audio never leaves your server.
  raw           jsonb,                    -- only populated for rows that failed to parse
  created_at    timestamptz not null default now(),
  unique (org_id, external_ref)            -- re-importing a file cannot duplicate calls
);

create table sale_events (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references orgs(id) on delete cascade,
  campaign_id           uuid not null references campaigns(id) on delete cascade,
  batch_id              uuid references import_batches(id) on delete set null,
  phone_hash            text not null,
  phone_last4           char(4),
  sale_date             date not null,
  product               text,
  agent_code            text,
  matched_call_event_id uuid references call_events(id) on delete set null,
  match_method          text check (match_method in ('same_day','adjacent_day','manual')),
  match_confidence      numeric(3,2),
  needs_review          boolean not null default false,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- claims and money

create table claims (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  currency     char(3) not null default 'USD',
  line_count   int not null default 0,
  total_cents  bigint not null default 0,
  status       text not null default 'draft'
               check (status in ('draft','issued','partially_paid','settled','disputed')),
  issued_at    timestamptz,
  created_at   timestamptz not null default now(),
  check (period_end >= period_start)
);

create table billable_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete cascade,
  campaign_id    uuid not null references campaigns(id) on delete cascade,
  call_event_id  uuid not null references call_events(id) on delete cascade,
  sale_event_id  uuid references sale_events(id) on delete set null,
  unit_type      text not null check (unit_type in ('transfer','sale')),
  rate_card_id   uuid references rate_cards(id),
  rate_cents     int  not null default 0,
  qualifies      boolean not null,
  qualify_reason text not null,
  claim_id       uuid references claims(id) on delete set null,
  status         text not null default 'draft'
                 check (status in ('draft','claimed','accepted','rejected','paid','written_off')),
  created_at     timestamptz not null default now(),
  unique (org_id, call_event_id, unit_type)   -- one call cannot be billed twice on the same basis
);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  received_at  date not null,
  amount_cents bigint not null check (amount_cents > 0),
  method       text,
  reference    text,
  note         text,
  created_at   timestamptz not null default now()
);

create table payment_allocations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  payment_id       uuid not null references payments(id) on delete cascade,
  billable_item_id uuid not null references billable_items(id) on delete cascade,
  amount_cents     bigint not null check (amount_cents > 0),
  created_at       timestamptz not null default now(),
  unique (payment_id, billable_item_id)
);

create table exceptions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  billable_item_id uuid not null references billable_items(id) on delete cascade,
  raised_by        text not null check (raised_by in ('client','us')),
  reason_code      text not null,
  reason_text      text,
  raised_at        timestamptz not null default now(),
  resolved_at      timestamptz,
  resolution       text check (resolution in ('accepted','overturned','written_off'))
);

create table audit_log (
  id            bigserial primary key,
  org_id        uuid not null references orgs(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action        text not null,
  entity        text not null,
  entity_id     text,
  before        jsonb,
  after         jsonb,
  at            timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes

create index on clients (org_id);
create index on campaigns (org_id, client_id);
create index on rate_cards (org_id, client_id, campaign_id, effective_from desc);
create index on call_events (org_id, campaign_id, call_at);
create index on call_events (org_id, phone_hash, call_at);
create index on sale_events (org_id, campaign_id, sale_date);
create index on sale_events (org_id, phone_hash, sale_date);
create index on billable_items (org_id, client_id, status);
create index on billable_items (claim_id);
create index on payment_allocations (billable_item_id);
create index on exceptions (org_id, resolved_at);
create index on audit_log (org_id, at desc);

-- ---------------------------------------------------------------- phone hashing

-- Returns the HMAC of a phone number using the caller's org salt.
-- The salt itself is never readable by any client role.
create or replace function public.hash_phone(p_org uuid, p_phone text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case
    when exists (select 1 from org_members m where m.org_id = p_org and m.user_id = auth.uid())
    then encode(
      extensions.hmac(
        regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
        (select s.phone_salt from org_secrets s where s.org_id = p_org),
        'sha256'
      ), 'hex')
    else null
  end;
$$;

revoke all on function public.hash_phone(uuid, text) from public, anon;
grant execute on function public.hash_phone(uuid, text) to authenticated;
