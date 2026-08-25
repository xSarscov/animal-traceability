import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { loadDashboardMetrics, type DashboardMetrics } from './dashboard'

type DashboardState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; metrics: DashboardMetrics }

const metricDefinitions: Array<{ key: keyof DashboardMetrics; label: string }> = [
  { key: 'animals', label: 'Animales registrados' },
  { key: 'availableMicrochips', label: 'Microchips disponibles' },
  { key: 'implantedMicrochips', label: 'Microchips implantados' },
  { key: 'lostAnimals', label: 'Animales perdidos' },
  { key: 'pendingRecoveryReports', label: 'Reportes pendientes' },
]

export function DashboardPage() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({ kind: 'loading' })
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true

    void loadDashboardMetrics()
      .then((metrics) => {
        if (active) setDashboardState({ kind: 'loaded', metrics })
      })
      .catch(() => {
        if (active) setDashboardState({ kind: 'error' })
      })

    return () => {
      active = false
    }
  }, [refreshVersion])

  function retry() {
    setDashboardState({ kind: 'loading' })
    setRefreshVersion((version) => version + 1)
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-emerald-700">RESUMEN</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Animal Traceability</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Estado actual de los animales, microchips y reportes de recuperación visibles para tu cuenta.
          </p>
        </div>
        <Link
          className="rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          to="/scan"
        >
          Escanear microchip
        </Link>
      </header>

      {dashboardState.kind === 'loading' ? (
        <p className="mt-8 text-sm text-stone-600" role="status">Cargando resumen…</p>
      ) : null}

      {dashboardState.kind === 'error' ? (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
          <h2 className="font-semibold text-red-900">No fue posible cargar el resumen.</h2>
          <button
            className="mt-4 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900"
            onClick={retry}
            type="button"
          >
            Reintentar
          </button>
        </section>
      ) : null}

      {dashboardState.kind === 'loaded' ? (
        <section aria-label="Métricas operativas" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metricDefinitions.map((metric) => (
            <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm" key={metric.key}>
              <h2 className="text-sm font-medium text-stone-600">{metric.label}</h2>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-950">{dashboardState.metrics[metric.key]}</p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  )
}
