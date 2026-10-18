# Checks

`verify.sql` is not a migration and is never applied automatically — it lives
outside `supabase/migrations/` so the GitHub integration ignores it.

Run it by hand in the SQL editor after a schema change. It creates test rows,
asserts six invariants, and rolls back, so it leaves nothing behind and is safe
against a live project. Read the result in the Notices panel, not Results.
