import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentOrg } from '@/lib/org'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings/clients', label: 'Clients' },
  { href: '/settings/campaigns', label: 'Campaigns' },
  { href: '/settings/rate-cards', label: 'Rate cards' },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg()
  if (!org) redirect('/login')

  return (
    <div className="min-h-screen">
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-baseline justify-between py-3 gap-4 flex-wrap">
            <div className="flex items-baseline gap-3">
              <span className="font-semibold tracking-tight">Claimline</span>
              <span className="text-sm text-ink-2">{org.orgName}</span>
            </div>
            <span className="text-xs text-ink-3">
              {org.email} · {org.role}
            </span>
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
