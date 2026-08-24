import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { supabase } from '../../lib/supabase'
import { useAuth } from './useAuth'

type LocationState = {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const { loading, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate replace to="/" />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMessage('No fue posible iniciar sesión. Verifica tu email y contraseña.')
      setIsSubmitting(false)
      return
    }

    const state = location.state as LocationState | null
    navigate(state?.from?.pathname ?? '/', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <section className="w-full rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.2em] text-emerald-700">MVP v0.1</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Iniciar sesión</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Accede al espacio privado de tu organización.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-stone-800" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label className="block text-sm font-medium text-stone-800" htmlFor="password">
            Contraseña
          </label>
          <input
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          {errorMessage ? (
            <p className="text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || loading}
            type="submit"
          >
            {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}
