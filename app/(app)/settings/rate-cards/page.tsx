import { createClient } from '@/lib/supabase/server'
import { createRateCard } from '../actions'
import { CreateForm, Field, inputClass } from '../ui'

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export default async function RateCardsPage() {
  const supabase = await createClient()
  const [{ data: cards }, { data: campaigns }] = await Promise.all([
    supabase
      .from('rate_cards')
      .select('id, unit_type, rate_cents, min_duration_sec, qualifying_statuses, effective_from, effective_to, campaigns(name)')
      .order('effective_from', { ascending: false }),
    supabase.from('campaigns').select('id, name, client_id, clients(name)').order('name'),
  ])

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Rate cards</h1>
      <p className="text-ink-2 mt-1 max-w-prose">
        What counts as billable, and what it pays. Rate cards are never edited — when a rate
        changes you add a new one with a later start date, so “what was the rate on 16 October”
        always has an answer.
      </p>

      <div className="mt-6">
        {campaigns?.length ? (
          <CreateForm action={createRateCard} submitLabel="Add rate card">
            <Field label="Campaign">
              <select name="campaign_id" required className={inputClass}
                      onChange={(e) => {
                        const form = e.currentTarget.form
                        const opt = e.currentTarget.selectedOptions[0]
                        if (form) (form.elements.namedItem('client_id') as HTMLInputElement).value =
                          opt.dataset.client ?? ''
                      }}>
                {campaigns.map((c) => {
                  const cl = c.clients as unknown as { name: string } | { name: string }[] | null
                  const clientName = Array.isArray(cl) ? cl[0]?.name : cl?.name
                  return (
                    <option key={c.id} value={c.id} data-client={c.client_id}>
                      {clientName} — {c.name}
                    </option>
                  )
                })}
              </select>
              <input type="hidden" name="client_id" defaultValue={campaigns[0]?.client_id ?? ''} />
            </Field>

            <Field label="Billed per">
              <select name="unit_type" className={inputClass}>
                <option value="transfer">Transfer</option>
                <option value="sale">Sale</option>
              </select>
            </Field>

            <Field label="Rate" hint="In dollars, e.g. 35 or 27.50.">
              <input name="rate" required className={inputClass} placeholder="35.00" />
            </Field>

            <Field label="Minimum duration" hint="Seconds the transfer must last to count.">
              <input name="min_duration_sec" type="number" min="0" defaultValue={90} className={inputClass} />
            </Field>

            <Field label="Billable dispositions" hint="Comma separated, as they appear in your dialer.">
              <input name="qualifying_statuses" required className={inputClass} placeholder="XFER, XFERA" />
            </Field>

            <Field label="Effective from">
              <input name="effective_from" type="date" required className={inputClass} />
            </Field>

            <Field label="Effective to" hint="Leave blank if it is the current rate.">
              <input name="effective_to" type="date" className={inputClass} />
            </Field>
          </CreateForm>
        ) : (
          <p className="text-sm text-ink-2 border border-line rounded-lg bg-surface p-5">
            Add a campaign first — a rate card has to attach to one.
          </p>
        )}
      </div>

      <div className="mt-8 border border-line rounded-lg bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {['Campaign', 'Per', 'Rate', 'Min', 'Billable', 'From', 'To'].map((h) => (
                <th key={h} className="text-left font-medium text-xs uppercase tracking-wider text-ink-3 px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(cards ?? []).map((c) => {
              const cp = c.campaigns as unknown as { name: string } | { name: string }[] | null
              const campaignName = Array.isArray(cp) ? cp[0]?.name : cp?.name
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{campaignName ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-2">{c.unit_type}</td>
                  <td className="px-4 py-3 tabular">{money(c.rate_cents)}</td>
                  <td className="px-4 py-3 tabular text-ink-2">{c.min_duration_sec}s</td>
                  <td className="px-4 py-3 text-ink-2">{(c.qualifying_statuses ?? []).join(', ')}</td>
                  <td className="px-4 py-3 tabular text-ink-2">{c.effective_from}</td>
                  <td className="px-4 py-3 tabular text-ink-2">{c.effective_to ?? 'current'}</td>
                </tr>
              )
            })}
            {!cards?.length && (
              <tr><td colSpan={7} className="px-4 py-6 text-ink-3">No rate cards yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
