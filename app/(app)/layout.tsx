import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg } from '@/lib/org'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings/clients', label: 'Clients' },
  { href: '/settings/campaigns', label: 'Campaigns' },
  { href: '/settings/rate-cards', label: 'Rate cards' },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const org = await getCurrentOrg()

  // Signed in but not a member of any organisation. Redirecting to /login here
  // would bounce forever, because the proxy sends a signed-in user straight
  // back to /dashboard. Explain it instead.
  if (user && !org) {
    return (
      <main className="min-h-screen grid place-items-center px-4">
        <div className="max-w-lg bg-surface border border-line rounded-lg p-8">
          <h1 className="text-lg font-semibold tracking-tight">No organisation yet</h1>
          <p className="text-sm text-ink-2 mt-2">
            You are signed in as <span className="text-ink">{user.email}</span>, but this
            account is not linked to an organisation, so there is nothing to show.
          </p>
          <p className="text-sm text-ink-2 mt-4">
            Run this in the Supabase SQL editor, replacing the id with your own user id
            from Authentication → Users:
          </p>
          <pre className="text-xs bg-canvas border border-line rounded-md p-3 mt-3 overflow-x-auto">{`with new_org as (
  insert into orgs (name) values ('Ironclad Tech') returning id
), secret as (
  insert into org_secrets (org_id) select id from new_org returning org_id
)
insert into org_members (org_id, user_id, role)
select id, '${user.id}', 'owner' from new_org;`}</pre>
          <p className="text-xs text-ink-3 mt-3">
            Your user id is already filled in above. Reload this page afterwards.
          </p>
        </div>
      </main>
    )
  }

  if (!org) return null

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-baseline justify-between py-3 gap-4 flex-wrap">
            <div className="flex items-baseline gap-3">
              <span className="font-semibold tracking-tight">Claimline</span>
              <span className="text-sm text-ink-2">{org.orgName}</span>
            </div>
            <span className="text-xs text-ink-3">{org.email} · {org.role}</span>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm text-ink-2 hover:text-ink border-b-2 border-transparent hover:border-line whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  )
}
