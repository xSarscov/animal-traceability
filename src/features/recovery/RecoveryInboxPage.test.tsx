import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listRecoveryReports = vi.hoisted(() => vi.fn())
const markRecoveryReportReviewed = vi.hoisted(() => vi.fn())
const closeRecoveryReport = vi.hoisted(() => vi.fn())
const RecoveryReportTransitionError = vi.hoisted(() => class RecoveryReportTransitionError extends Error {
  readonly kind: 'conflict' | 'generic'
  constructor(kind: 'conflict' | 'generic') { super('transition'); this.kind = kind }
})

vi.mock('./recovery-inbox', () => ({ listRecoveryReports, markRecoveryReportReviewed, closeRecoveryReport, RecoveryReportTransitionError }))

import { RecoveryInboxPage } from './RecoveryInboxPage'

const reports = [
  { id: 'report-pending', status: 'pending' as const, reporterName: 'Persona Demo', contact: 'contacto-demo@example.test', message: 'Encontré a Luna.', createdAt: '2026-08-25T12:00:00Z', animal: { id: 'animal-luna', name: 'Luna', status: 'lost' as const, microchipCode: '990000015300168' } },
  { id: 'report-reviewed', status: 'reviewed' as const, reporterName: 'Persona Revisó', contact: 'revisado@example.test', message: null, createdAt: '2026-08-24T12:00:00Z', animal: { id: 'animal-bruno', name: 'Bruno', status: 'active' as const, microchipCode: '990000015300169' } },
  { id: 'report-closed', status: 'closed' as const, reporterName: 'Persona Cerró', contact: 'cerrado@example.test', message: null, createdAt: '2026-08-23T12:00:00Z', animal: { id: 'animal-nube', name: 'Nube', status: 'deceased' as const, microchipCode: '990000015300170' } },
]

function renderPage() { return render(<MemoryRouter><RecoveryInboxPage /></MemoryRouter>) }

describe('RecoveryInboxPage', () => {
  beforeEach(() => {
    listRecoveryReports.mockReset().mockResolvedValue(reports)
    markRecoveryReportReviewed.mockReset()
    closeRecoveryReport.mockReset()
  })
  afterEach(cleanup)

  it('shows loading without an empty state prematurely', () => {
    listRecoveryReports.mockReturnValue(new Promise(() => undefined))
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando reportes…')
    expect(screen.queryByText('No hay reportes de recuperación.')).not.toBeInTheDocument()
  })

  it('renders private reporter data, current animal data and lifecycle actions without UUIDs', async () => {
    renderPage()
    expect(await screen.findByText('Luna')).toBeInTheDocument()
    expect(screen.getByText('990000015300168')).toBeInTheDocument()
    expect(screen.getByText('Persona Demo')).toBeInTheDocument()
    expect(screen.getByText('contacto-demo@example.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar como revisado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar reporte' })).toBeInTheDocument()
    expect(screen.queryByText('report-pending')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Ver animal' })[0]).toHaveAttribute('href', '/animals/animal-luna')
  })

  it('distinguishes global and filtered empty states', async () => {
    const user = userEvent.setup()
    listRecoveryReports.mockResolvedValueOnce([])
    const empty = renderPage()
    expect(await screen.findByText('No hay reportes de recuperación.')).toBeInTheDocument()
    empty.unmount()

    renderPage()
    await screen.findByText('Luna')
    await user.selectOptions(screen.getByLabelText('Estado'), 'closed')
    expect(screen.getByText('Nube')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Estado'), 'pending')
    expect(screen.queryByText('Nube')).not.toBeInTheDocument()
    expect(screen.getByText('Luna')).toBeInTheDocument()
  })

  it('shows a filtered empty state', async () => {
    const user = userEvent.setup()
    listRecoveryReports.mockResolvedValue([{ ...reports[0] }])
    renderPage()
    await screen.findByText('Luna')
    await user.selectOptions(screen.getByLabelText('Estado'), 'closed')
    expect(screen.getByText('No hay reportes con este estado.')).toBeInTheDocument()
  })

  it('retries the complete inbox load after a safe error', async () => {
    const user = userEvent.setup()
    listRecoveryReports.mockRejectedValueOnce(new Error('backend')).mockResolvedValueOnce(reports)
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar los reportes.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Luna')).toBeInTheDocument()
    expect(listRecoveryReports).toHaveBeenCalledTimes(2)
  })

  it('reviews a pending report once and refreshes the confirmed list', async () => {
    const user = userEvent.setup()
    let resolveReview: (() => void) | undefined
    listRecoveryReports.mockResolvedValueOnce(reports).mockResolvedValueOnce([{ ...reports[0], status: 'reviewed' as const }])
    markRecoveryReportReviewed.mockReturnValue(new Promise<void>((resolve) => { resolveReview = resolve }))
    renderPage()
    await screen.findByText('Luna')
    await user.click(screen.getByRole('button', { name: 'Marcar como revisado' }))
    expect(markRecoveryReportReviewed).toHaveBeenCalledWith('report-pending')
    expect(screen.getByRole('button', { name: 'Marcando como revisado…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Marcando como revisado…' }))
    expect(markRecoveryReportReviewed).toHaveBeenCalledOnce()
    resolveReview?.()
    expect(await screen.findByText('Reporte marcado como revisado.')).toBeInTheDocument()
    await waitFor(() => expect(listRecoveryReports).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Cerrar reporte' })).toBeInTheDocument()
  })

  it('closes a reviewed report and shows no lifecycle action after refresh', async () => {
    const user = userEvent.setup()
    listRecoveryReports.mockResolvedValueOnce([reports[1]]).mockResolvedValueOnce([{ ...reports[1], status: 'closed' as const }])
    closeRecoveryReport.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText('Bruno')
    await user.click(screen.getByRole('button', { name: 'Cerrar reporte' }))
    expect(closeRecoveryReport).toHaveBeenCalledWith('report-reviewed')
    expect(await screen.findByText('Reporte cerrado.')).toBeInTheDocument()
    await waitFor(() => expect(listRecoveryReports).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: /reporte/ })).not.toBeInTheDocument()
  })

  it('refreshes on conflict and keeps the report visible after a generic error', async () => {
    const user = userEvent.setup()
    listRecoveryReports.mockResolvedValueOnce([reports[0]]).mockResolvedValueOnce([{ ...reports[0], status: 'reviewed' as const }])
    markRecoveryReportReviewed.mockRejectedValueOnce(new RecoveryReportTransitionError('conflict'))
    renderPage()
    await screen.findByText('Luna')
    await user.click(screen.getByRole('button', { name: 'Marcar como revisado' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El reporte cambió o la acción ya no está disponible.')
    await waitFor(() => expect(listRecoveryReports).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Cerrar reporte' })).toBeInTheDocument()

    closeRecoveryReport.mockRejectedValueOnce(new Error('backend'))
    await user.click(screen.getByRole('button', { name: 'Cerrar reporte' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible actualizar el reporte.')
    expect(screen.getByRole('button', { name: 'Cerrar reporte' })).toBeEnabled()
  })
})
