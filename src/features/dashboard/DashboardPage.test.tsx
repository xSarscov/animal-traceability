import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadDashboardMetrics = vi.hoisted(() => vi.fn())

vi.mock('./dashboard', () => ({ loadDashboardMetrics }))

import { DashboardPage } from './DashboardPage'

const metrics = {
  animals: 12,
  availableMicrochips: 50,
  implantedMicrochips: 12,
  lostAnimals: 3,
  pendingRecoveryReports: 4,
}

function renderPage() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>)
}

describe('DashboardPage', () => {
  beforeEach(() => loadDashboardMetrics.mockReset().mockResolvedValue(metrics))
  afterEach(cleanup)

  it('shows loading without provisional metric cards', () => {
    let resolveMetrics: ((value: typeof metrics) => void) | undefined
    loadDashboardMetrics.mockReturnValue(new Promise<typeof metrics>((resolve) => { resolveMetrics = resolve }))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando resumen…')
    expect(screen.queryByRole('heading', { name: 'Animales registrados' })).not.toBeInTheDocument()
    resolveMetrics?.(metrics)
  })

  it('renders each metric and the scan CTA', async () => {
    renderPage()

    const cards = await screen.findByRole('region', { name: 'Métricas operativas' })
    expect(cards).toHaveTextContent('Animales registrados12')
    expect(cards).toHaveTextContent('Microchips disponibles50')
    expect(cards).toHaveTextContent('Microchips implantados12')
    expect(cards).toHaveTextContent('Animales perdidos3')
    expect(cards).toHaveTextContent('Reportes pendientes4')
    expect(screen.getByRole('link', { name: 'Escanear microchip' })).toHaveAttribute('href', '/scan')
  })

  it('renders five valid zero metrics without an empty state', async () => {
    loadDashboardMetrics.mockResolvedValue({
      animals: 0,
      availableMicrochips: 0,
      implantedMicrochips: 0,
      lostAnimals: 0,
      pendingRecoveryReports: 0,
    })
    renderPage()

    const cards = await screen.findAllByRole('heading', { level: 2 })
    expect(cards).toHaveLength(5)
    expect(screen.getAllByText('0')).toHaveLength(5)
    expect(screen.queryByText('No hay datos')).not.toBeInTheDocument()
  })

  it('shows a safe error and retries the metrics load', async () => {
    const user = userEvent.setup()
    loadDashboardMetrics.mockRejectedValueOnce(new Error('backend')).mockResolvedValueOnce(metrics)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar el resumen.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Reportes pendientes')).toBeInTheDocument()
    expect(loadDashboardMetrics).toHaveBeenCalledTimes(2)
  })
})
