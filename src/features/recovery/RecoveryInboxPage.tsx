import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { formatDateTime } from '../../lib/dates'
import {
  closeRecoveryReport,
  listRecoveryReports,
  markRecoveryReportReviewed,
  RecoveryReportTransitionError,
  type RecoveryInboxItem,
} from './recovery-inbox'

type InboxState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; reports: RecoveryInboxItem[] }

type StatusFilter = 'all' | RecoveryInboxItem['status']

const filterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Revisados', value: 'reviewed' },
  { label: 'Cerrados', value: 'closed' },
]

export function RecoveryInboxPage() {
  const [inboxState, setInboxState] = useState<InboxState>({ kind: 'loading' })
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [transitioningReportIds, setTransitioningReportIds] = useState<string[]>([])
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    let active = true

    void listRecoveryReports()
      .then((reports) => { if (active) setInboxState({ kind: 'loaded', reports }) })
      .catch(() => { if (active) setInboxState({ kind: 'error' }) })

    return () => { active = false }
  }, [refreshVersion])

  const refreshInbox = () => {
    setInboxState({ kind: 'loading' })
    setRefreshVersion((version) => version + 1)
  }

  const visibleReports = useMemo(() => {
    if (inboxState.kind !== 'loaded') return []
    return inboxState.reports.filter((report) => statusFilter === 'all' || report.status === statusFilter)
  }, [inboxState, statusFilter])

  async function transitionReport(report: RecoveryInboxItem) {
    if (transitioningReportIds.includes(report.id)) return

    setMessage(null)
    setTransitioningReportIds((ids) => [...ids, report.id])

    try {
      if (report.status === 'pending') {
        await markRecoveryReportReviewed(report.id)
        setMessage({ kind: 'success', text: 'Reporte marcado como revisado.' })
      } else if (report.status === 'reviewed') {
        await closeRecoveryReport(report.id)
        setMessage({ kind: 'success', text: 'Reporte cerrado.' })
      } else {
        return
      }

      refreshInbox()
    } catch (error) {
      if (error instanceof RecoveryReportTransitionError && error.kind === 'conflict') {
        setMessage({ kind: 'error', text: 'El reporte cambió o la acción ya no está disponible.' })
        refreshInbox()
      } else {
        setMessage({ kind: 'error', text: 'No fue posible actualizar el reporte.' })
      }
    } finally {
      setTransitioningReportIds((ids) => ids.filter((id) => id !== report.id))
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-emerald-700">RECUPERACIÓN</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Reportes de recuperación</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Reportes enviados cuando una persona encontró un animal perdido.
        </p>
      </header>

      {message ? <p className={`mt-6 text-sm ${message.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {inboxState.kind === 'loading' ? <p className="mt-8 text-sm text-stone-600" role="status">Cargando reportes…</p> : null}
      {inboxState.kind === 'error' ? <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5" role="alert"><h2 className="font-semibold text-red-900">No fue posible cargar los reportes.</h2><button className="mt-4 rounded-md bg-red-800 px-3 py-2 text-sm font-semibold text-white" onClick={refreshInbox} type="button">Reintentar</button></section> : null}

      {inboxState.kind === 'loaded' && inboxState.reports.length === 0 ? <section className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-6"><h2 className="font-semibold text-stone-950">No hay reportes de recuperación.</h2></section> : null}

      {inboxState.kind === 'loaded' && inboxState.reports.length > 0 ? <>
        <div className="mt-8 max-w-xs">
          <label className="block text-sm font-medium text-stone-800" htmlFor="recovery-status-filter">Estado</label>
          <select className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-950" id="recovery-status-filter" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
            {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        {visibleReports.length === 0 ? <section className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-6"><h2 className="font-semibold text-stone-950">No hay reportes con este estado.</h2></section> : <section className="mt-6 space-y-4" aria-label="Listado de reportes de recuperación">
          {visibleReports.map((report) => <RecoveryReportCard key={report.id} report={report} isSubmitting={transitioningReportIds.includes(report.id)} onTransition={() => void transitionReport(report)} />)}
        </section>}
      </> : null}
    </main>
  )
}

function RecoveryReportCard({ isSubmitting, onTransition, report }: { isSubmitting: boolean; onTransition: () => void; report: RecoveryInboxItem }) {
  const action = report.status === 'pending'
    ? { idle: 'Marcar como revisado', loading: 'Marcando como revisado…' }
    : report.status === 'reviewed'
      ? { idle: 'Cerrar reporte', loading: 'Cerrando…' }
      : null

  return <article className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-stone-500">ANIMAL</p>
        <h2 className="mt-1 text-xl font-semibold text-stone-950">{report.animal.name}</h2>
        <p className="mt-1 font-mono text-sm text-stone-700">{report.animal.microchipCode}</p>
      </div>
      <div className="flex flex-wrap gap-2"><StatusBadge label={animalStatusLabel(report.animal.status)} /><StatusBadge label={reportStatusLabel(report.status)} /></div>
    </div>

    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
      <Detail label="Persona" value={report.reporterName} />
      <Detail label="Contacto" value={report.contact} />
      <Detail label="Recibido" value={formatDateTime(report.createdAt)} />
      <Detail label="Mensaje" value={report.message ?? '—'} />
    </dl>

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Link className="text-sm font-semibold text-emerald-800 underline underline-offset-4" to={`/animals/${report.animal.id}`}>Ver animal</Link>
      {action ? <button className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-950 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} onClick={onTransition} type="button">{isSubmitting ? action.loading : action.idle}</button> : null}
    </div>
  </article>
}

function StatusBadge({ label }: { label: string }) { return <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-800">{label}</span> }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-stone-500">{label}</dt><dd className="mt-1 font-medium text-stone-900">{value}</dd></div> }
function reportStatusLabel(status: RecoveryInboxItem['status']) { return ({ pending: 'Pendiente', reviewed: 'Revisado', closed: 'Cerrado' })[status] }
function animalStatusLabel(status: RecoveryInboxItem['animal']['status']) { return ({ active: 'Activo', lost: 'Perdido', deceased: 'Fallecido' })[status] }
