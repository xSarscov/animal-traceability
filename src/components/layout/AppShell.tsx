import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'

import { useAuth } from '../../features/auth/useAuth'
import { supabase } from '../../lib/supabase'

export function AppShell() {
  const { user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSignOut() {
    setErrorMessage(null)
    setIsSigningOut(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage('No fue posible cerrar sesión. Inténtalo de nuevo.')
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold tracking-tight text-stone-950">Animal Traceability</span>
            <nav aria-label="Navegación principal" className="flex items-center gap-4 text-sm font-medium">
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'text-emerald-800 underline underline-offset-4' : 'text-stone-600 hover:text-stone-950'
                }
                end
                to="/"
              >
                Inicio
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'text-emerald-800 underline underline-offset-4' : 'text-stone-600 hover:text-stone-950'
                }
                to="/scan"
              >
                Escanear
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'text-emerald-800 underline underline-offset-4' : 'text-stone-600 hover:text-stone-950'
                }
                to="/microchips"
              >
                Microchips
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'text-emerald-800 underline underline-offset-4' : 'text-stone-600 hover:text-stone-950'
                }
                to="/recovery-reports"
              >
                Reportes
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-600 sm:inline">{user?.email}</span>
            <button
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </header>
      {errorMessage ? (
        <p className="mx-auto max-w-4xl px-6 pt-4 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Outlet />
    </div>
  )
}
