# Claimline

Turns a dialer export and a sales sheet into an itemised, evidence-backed billing
claim, then tracks what the client accepted, rejected and actually paid — line by line.

## Why it exists

Clients pay a lump sum with no line detail. They can reject individual transfers on
quality, but because the payment is a single figure, those rejections are invisible:
the total is simply smaller. Roughly 5–10% of expected revenue disappears into that
gap every month, and nobody can say which calls it relates to.

Claimline issues the itemised claim **before** payment, so a rejection has to name a
specific line and a specific reason. It requires nothing of the client — no login,
no integration, no cooperation.

## What it deliberately is not

Not a CRM, a dialer, an accounting package, or a reporting suite. Explicitly out of
scope for v1: campaign margin and P&L, agent incentive reconciliation, recording
storage, self-serve signup and billing, and any client-facing portal.

## Design rules

1. **Money is integer cents.** Never floats. Rounding disputes are the thing this
   product exists to prevent.
2. **Phone numbers are never stored in the clear.** Ingest hashes them with a
   per-org HMAC salt that no client role can read; `phone_last4` is kept for humans.
3. **Recordings are referenced, never ingested.** The filename is stored; the audio
   stays on the customer's own server.
4. **Rate cards are versioned, never edited.** "What was the rate on 16 October"
   must always be answerable.
5. **Isolation is enforced by row-level security**, not by application queries.
6. **Matching never guesses.** Ambiguity goes to a human. One false line on a claim
   destroys the credibility of the other 339.
7. **The audit log is append-only**, including for owners.

## Layout

    lib/money.ts       integer-cent arithmetic
    lib/qualify.ts     is this call billable, and why       (pure, tested)
    lib/match.ts       tie a logged sale to its call        (pure, tested)
    lib/allocate.ts    apply a payment to specific lines    (pure, tested)
    supabase/migrations/<ts>_init.sql    schema
    supabase/migrations/<ts>_rls.sql     row-level security
    tests/                               unit tests for the pure logic

The three pure modules are where every dispute originates. They take plain objects,
return plain objects, touch no database, and are tested first.

## Running the tests

    npm test

## Deployment

The Supabase GitHub integration applies everything in `supabase/migrations/`
in timestamp order, skipping any file already recorded in that database's
`supabase_migrations.schema_migrations` table. Each file runs inside a single
transaction.

Two consequences worth remembering:

- **Never edit a migration that has already been applied anywhere.** Its
  checksum is recorded. Add a new timestamped migration instead.
- **Never apply a migration by hand in the SQL editor on a project the
  integration deploys to.** The schema changes but the history table does not,
  so the next push tries to run it again and fails on "relation already
  exists". If that happens, `supabase migration repair --status applied <ts>`
  tells the history table it was already done.
