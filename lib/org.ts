import { createClient } from '@/lib/supabase/server'

export interface CurrentOrg {
  orgId: string
  orgName: string
  role: 'owner' | 'manager' | 'finance' | 'viewer'
  email: string
}

/**
 * Resolves the signed-in user's organisation.
 *
 * This is convenience, not security. Row-level security already restricts
 * every query to the caller's org; if this returned the wrong id the database
 * would simply return nothing rather than another tenant's rows.
 */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('org_members')
    .select('role, org_id, orgs(name)')
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const orgs = data.orgs as unknown as { name: string } | { name: string }[] | null
  const orgName = Array.isArray(orgs) ? orgs[0]?.name : orgs?.name

  return {
    orgId: data.org_id as string,
    orgName: orgName ?? 'Unknown organisation',
    role: data.role as CurrentOrg['role'],
    email: user.email ?? '',
  }
}

export function canWrite(role: CurrentOrg['role']) {
  return role === 'owner' || role === 'manager' || role === 'finance'
}
