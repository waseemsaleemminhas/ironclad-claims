'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/org'

type Result = { error: string | null }

export async function createClientRecord(formData: FormData): Promise<Result> {
  const org = await getCurrentOrg()
  if (!org) return { error: 'Not signed in' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Client name is required' }

  const terms = Number(formData.get('payment_terms_days') ?? 30)
  if (!Number.isFinite(terms) || terms < 0) return { error: 'Payment terms must be a number of days' }

  const supabase = await createClient()
  const { error } = await supabase.from('clients').insert({
    org_id: org.orgId, name, payment_terms_days: terms,
  })
  if (error) return { error: error.message }

  revalidatePath('/settings/clients')
  return { error: null }
}

export async function createCampaign(formData: FormData): Promise<Result> {
  const org = await getCurrentOrg()
  if (!org) return { error: 'Not signed in' }

  const name = String(formData.get('name') ?? '').trim()
  const clientId = String(formData.get('client_id') ?? '')
  if (!name) return { error: 'Campaign name is required' }
  if (!clientId) return { error: 'Pick a client' }

  const supabase = await createClient()
  const { error } = await supabase.from('campaigns').insert({
    org_id: org.orgId,
    client_id: clientId,
    name,
    vertical: String(formData.get('vertical') ?? '').trim() || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/settings/campaigns')
  return { error: null }
}

export async function createRateCard(formData: FormData): Promise<Result> {
  const org = await getCurrentOrg()
  if (!org) return { error: 'Not signed in' }

  const campaignId = String(formData.get('campaign_id') ?? '')
  const clientId = String(formData.get('client_id') ?? '')
  if (!campaignId || !clientId) return { error: 'Pick a campaign' }

  // Rates are entered in dollars and stored as integer cents. Parsing here
  // rather than multiplying by 100 avoids float error on values like 27.35.
  const raw = String(formData.get('rate') ?? '').trim().replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { error: 'Rate must look like 35 or 27.50' }
  const [whole, frac = ''] = raw.split('.')
  const rateCents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))

  const minDuration = Number(formData.get('min_duration_sec') ?? 0)
  if (!Number.isFinite(minDuration) || minDuration < 0) return { error: 'Minimum duration must be seconds' }

  const statuses = String(formData.get('qualifying_statuses') ?? '')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
  if (statuses.length === 0) return { error: 'List at least one billable disposition' }

  const effectiveFrom = String(formData.get('effective_from') ?? '')
  if (!effectiveFrom) return { error: 'Effective from date is required' }

  const supabase = await createClient()
  const { error } = await supabase.from('rate_cards').insert({
    org_id: org.orgId,
    client_id: clientId,
    campaign_id: campaignId,
    unit_type: String(formData.get('unit_type') ?? 'transfer'),
    rate_cents: rateCents,
    min_duration_sec: minDuration,
    qualifying_statuses: statuses,
    effective_from: effectiveFrom,
    effective_to: String(formData.get('effective_to') ?? '') || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/settings/rate-cards')
  return { error: null }
}
