import { useEffect, useMemo, useState } from 'react'

import { MicrochipStatusBadge } from './MicrochipStatusBadge'
import { listMicrochips, type MicrochipInventoryRow } from './microchip-inventory'

type StatusFilter = 'all' | MicrochipInventoryRow['status']

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Todos los estados', value: 'all' },
  { label: 'Disponible', value: 'available' },
  { label: 'Implantado', value: 'implanted' },
  { label: 'Bloqueado', value: 'blocked' },
]

export function MicrochipInventoryPage() {
  const [microchips, setMicrochips] = useState<MicrochipInventoryRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void listMicrochips()
      .then((inventory) => {
        if (isActive) {
          setMicrochips(inventory)
        }
      })
      .catch(() => {
        if (isActive) {
          setError('No fue posible cargar el inventario.')
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  async function retryLoadInventory() {
    setLoading(true)
    setError(null)

    try {
      setMicrochips(await listMicrochips())
    } catch {
      setError('No fue posible cargar el inventario.')
    } finally {
      setLoading(false)
    }
  }

  const visibleMicrochips = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()

    return microchips.filter((microchip) => {
      const matchesCode = microchip.code.toLocaleLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'all' || microchip.status === statusFilter

      return matchesCode && matchesStatus
    })
  }, [microchips, searchQuery, statusFilter])

  function clearFilters() {
    setSearchQuery('')
    setStatusFilter('all')
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <section aria-labelledby="microchips-heading">
        <p className="text-sm font-semibold tracking-[0.2em] text-emerald-700">INVENTARIO</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950" id="microchips-heading">
          Microchips
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Identificadores registrados y autorizados para tu sesión.
        </p>
      </section>

      {loading ? (
        <p className="mt-8 text-sm text-stone-600" role="status">
          Cargando inventario…
        </p>
      ) : null}

      {error ? (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
          <h2 className="font-semibold text-red-900">No fue posible cargar el inventario.</h2>
          <p className="mt-1 text-sm text-red-800">Comprueba tu conexión e inténtalo de nuevo.</p>
          <button
            className="mt-4 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
            onClick={() => void retryLoadInventory()}
            type="button"
          >
            Reintentar
          </button>
        </section>
      ) : null}

      {!loading && !error && microchips.length === 0 ? (
        <section className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-6">
          <h2 className="font-semibold text-stone-950">No hay microchips registrados.</h2>
          <p className="mt-1 text-sm text-stone-600">
            Cuando existan identificadores autorizados para tu organización aparecerán aquí.
          </p>
        </section>
      ) : null}

      {!loading && !error && microchips.length > 0 ? (
        <>
          <section className="mt-8 grid gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div>
              <label className="block text-sm font-medium text-stone-800" htmlFor="microchip-search">
                Buscar por código
              </label>
              <input
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                id="microchip-search"
                inputMode="numeric"
                onChange={(event) => setSearchQuery(event.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 990000"
                type="search"
                value={searchQuery}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-800" htmlFor="microchip-status-filter">
                Estado
              </label>
              <select
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                id="microchip-status-filter"
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                value={statusFilter}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {visibleMicrochips.length === 0 ? (
            <section className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-6">
              <h2 className="font-semibold text-stone-950">No encontramos microchips con estos filtros.</h2>
              <button
                className="mt-3 text-sm font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                onClick={clearFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            </section>
          ) : (
            <section className="mt-6 space-y-4" aria-label="Listado de microchips">
              {visibleMicrochips.map((microchip) => (
                <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm" key={microchip.code}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.16em] text-stone-500">CÓDIGO</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-stone-950">{microchip.code}</p>
                    </div>
                    <MicrochipStatusBadge status={microchip.status} />
                  </div>
                  <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-stone-500">Tecnología</dt>
                      <dd className="mt-1 font-medium text-stone-900">{microchip.technology}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Frecuencia</dt>
                      <dd className="mt-1 font-medium text-stone-900">{microchip.frequency_khz} kHz</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Estándar</dt>
                      <dd className="mt-1 font-medium text-stone-900">{microchip.standard}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Lote</dt>
                      <dd className="mt-1 font-medium text-stone-900">{microchip.batch_code ?? '—'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </section>
          )}

          <p className="mt-5 text-sm text-stone-600">
            {visibleMicrochips.length === 1 ? '1 microchip' : `${visibleMicrochips.length} microchips`}
          </p>
        </>
      ) : null}
    </main>
  )
}
