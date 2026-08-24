import { createBrowserRouter } from 'react-router'

import { AppShell } from '../components/layout/AppShell'

function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl items-center px-6 py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-emerald-700">MVP v0.1</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
          Identificación y trazabilidad animal
        </h1>
        <p className="mt-5 text-lg leading-8 text-stone-600">
          Bootstrap técnico listo para los siguientes milestones.
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
    path: '/',
    element: <AppShell />,
    children: [{ index: true, element: <HomePage /> }],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
