'use client'

import { useState, useTransition } from 'react'

export function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3 mt-1">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full border border-line rounded-md px-3 py-2 bg-canvas focus:outline-2 focus:outline-accent'

export function CreateForm({
  action, submitLabel, children,
}: {
  action: (fd: FormData) => Promise<{ error: string | null }>
  submitLabel: string
  children: React.ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await action(fd)
          setError(res.error)
        })
      }
      className="border border-line rounded-lg bg-surface p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      <div className="flex items-center gap-4 mt-5">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving…' : submitLabel}
        </button>
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </form>
  )
}
