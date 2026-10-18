'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-surface border border-line rounded-lg p-8"
      >
        <h1 className="text-xl font-semibold tracking-tight">Claimline</h1>
        <p className="text-sm text-ink-2 mt-1 mb-6">Sign in to continue.</p>

        <label className="block text-xs uppercase tracking-wider text-ink-3 mb-1.5" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 mb-4 bg-canvas focus:outline-2 focus:outline-accent"
        />

        <label className="block text-xs uppercase tracking-wider text-ink-3 mb-1.5" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 mb-6 bg-canvas focus:outline-2 focus:outline-accent"
        />

        {error && <p className="text-sm text-bad mb-4">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent text-white rounded-md py-2.5 font-medium disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
