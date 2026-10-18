import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/org'

function money(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default async function DashboardPage() {
  const org = await getCurrentOrg()
  const supabase = await createClient()

  const [clients, campaigns, rateCards, calls] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }),
    supabase.from('rate_cards').select('id', { count: 'exact', head: true }),
    supabase.from('call_events').select('id', { count: 'exact', head: true }),
  ])

  const setupDone = (clients.count ?? 0) > 0 && (campaigns.count ?? 0) > 0 && (rateCards.count ?? 0) > 0

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-ink-2 mt-1">{org?.orgName}</p>

      <div className="grid gap-px bg-line border border-line rounded-lg overflow-hidden mt-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Clients', clients.count ?? 0],
          ['Campaigns', campaigns.count ?? 0],
          ['Rate cards', rateCards.count ?? 0],
          ['Calls imported', calls.count ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-surface p-5">
            <div className="text-xs uppercase tracking-wider text-ink-3">{label}</div>
            <div className="text-3xl font-semibold tabular mt-2">{value as number}</div>
          </div>
        ))}
      </div>

      {!setupDone && (
        <section className="mt-8 border border-line rounded-lg bg-surface p-6">
          <h2 className="font-semibold">Finish setting up</h2>
          <p className="text-sm text-ink-2 mt-1 max-w-prose">
            Nothing can be claimed until the system knows who you bill, for which campaign,
            and at what rate. Work through these in order.
          </p>
          <ol className="mt-4 space-y-2 text-sm">
            <li className={clients.count ? 'text-ink-3 line-through' : ''}>
              1. Add a client — whoever pays you.
            </li>
            <li className={campaigns.count ? 'text-ink-3 line-through' : ''}>
              2. Add a campaign under that client.
            </li>
            <li className={rateCards.count ? 'text-ink-3 line-through' : ''}>
              3. Add a rate card — what counts as billable, and what it pays.
            </li>
          </ol>
        </section>
      )}

      <p className="text-sm text-ink-3 mt-8">
        Import, claims and payments are not built yet. Setup first.
      </p>
    </>
  )
}
