import { Navigate, createBrowserRouter } from 'react-router'

import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'

function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl items-center px-6 py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-emerald-700">MVP v0.1</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
          Identificación y trazabilidad animal
        </h1>
        <p className="mt-5 text-lg leading-8 text-stone-600">
          La autenticación y el aislamiento de organizaciones están preparados. Las funcionalidades
          de dominio se incorporarán en sus milestones correspondientes.
        </p>
      </section>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <section>
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">Página no encontrada</h1>
      </section>
    </main>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'scan', element: <Navigate replace to="/" /> },
          { path: 'animals', element: <Navigate replace to="/" /> },
          { path: 'animals/new', element: <Navigate replace to="/" /> },
          { path: 'animals/:animalId', element: <Navigate replace to="/" /> },
          { path: 'microchips', element: <Navigate replace to="/" /> },
          { path: 'recovery-reports', element: <Navigate replace to="/" /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
