import { createClient } from '@/lib/supabase/server'
import { createClientRecord } from '../actions'
import { CreateForm, Field, inputClass } from '../ui'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, payment_terms_days, active')
    .order('name')

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
      <p className="text-ink-2 mt-1 max-w-prose">
        Whoever pays you. One row per agency or lead buyer you invoice.
      </p>

      <div className="mt-6">
        <CreateForm action={createClientRecord} submitLabel="Add client">
          <Field label="Name">
            <input name="name" required className={inputClass} placeholder="Acme Insurance Group" />
          </Field>
          <Field label="Payment terms" hint="Days from period close, for ageing.">
            <input name="payment_terms_days" type="number" min="0" defaultValue={30} className={inputClass} />
          </Field>
        </CreateForm>
      </div>

      <div className="mt-8 border border-line rounded-lg bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left font-medium text-xs uppercase tracking-wider text-ink-3 px-4 py-3">Name</th>
              <th className="text-right font-medium text-xs uppercase tracking-wider text-ink-3 px-4 py-3">Terms</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-right tabular">{c.payment_terms_days} days</td>
              </tr>
            ))}
            {!clients?.length && (
              <tr><td colSpan={2} className="px-4 py-6 text-ink-3">No clients yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
