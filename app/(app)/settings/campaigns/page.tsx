import { createClient } from '@/lib/supabase/server'
import { createCampaign } from '../actions'
import { CreateForm, Field, inputClass } from '../ui'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const [{ data: campaigns }, { data: clients }] = await Promise.all([
    supabase.from('campaigns').select('id, name, vertical, clients(name)').order('name'),
    supabase.from('clients').select('id, name').order('name'),
  ])

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
      <p className="text-ink-2 mt-1 max-w-prose">
        A campaign is one client’s programme — Final Expense, Medicare, ACA. Rates attach here,
        because the same client can pay differently per programme.
      </p>

      <div className="mt-6">
        {clients?.length ? (
          <CreateForm action={createCampaign} submitLabel="Add campaign">
            <Field label="Client">
              <select name="client_id" required className={inputClass}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Name">
              <input name="name" required className={inputClass} placeholder="Final Expense — day shift" />
            </Field>
            <Field label="Vertical" hint="Optional. Final Expense, Medicare, ACA.">
              <input name="vertical" className={inputClass} />
            </Field>
          </CreateForm>
        ) : (
          <p className="text-sm text-ink-2 border border-line rounded-lg bg-surface p-5">
            Add a client first — a campaign has to belong to one.
          </p>
        )}
      </div>

      <div className="mt-8 border border-line rounded-lg bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {['Campaign', 'Client', 'Vertical'].map((h) => (
                <th key={h} className="text-left font-medium text-xs uppercase tracking-wider text-ink-3 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((c) => {
              const cl = c.clients as unknown as { name: string } | { name: string }[] | null
              const clientName = Array.isArray(cl) ? cl[0]?.name : cl?.name
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-ink-2">{clientName ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-2">{c.vertical ?? '—'}</td>
                </tr>
              )
            })}
            {!campaigns?.length && (
              <tr><td colSpan={3} className="px-4 py-6 text-ink-3">No campaigns yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
