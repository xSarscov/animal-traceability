import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from './useAuth'

export function RequireAuth() {
  const { loading, session } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
        <p className="text-sm text-stone-600" role="status">
          Comprobando sesión…
        </p>
      </main>
    )
  }

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return <Outlet />
}
