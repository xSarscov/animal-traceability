import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listMicrochipsMock = vi.hoisted(() => vi.fn())

vi.mock('./microchip-inventory', () => ({
  listMicrochips: listMicrochipsMock,
}))

import { MicrochipInventoryPage } from './MicrochipInventoryPage'

const inventoryFixture = [
  {
    batch_code: null,
    code: '990000015300168',
    frequency_khz: 134.2,
    standard: 'ISO 11784/11785',
    status: 'available' as const,
    technology: 'FDX-B',
  },
  {
    batch_code: 'LOTE-02',
    code: '990000015300169',
    frequency_khz: 134.2,
    standard: 'ISO 11784/11785',
    status: 'implanted' as const,
    technology: 'FDX-B',
  },
  {
    batch_code: 'LOTE-03',
    code: '880000000000001',
    frequency_khz: 125,
    standard: 'ISO 11784/11785',
    status: 'blocked' as const,
    technology: 'EMID',
  },
]

describe('MicrochipInventoryPage', () => {
  beforeEach(() => {
    listMicrochipsMock.mockReset().mockResolvedValue(inventoryFixture)
  })

  afterEach(() => {
    cleanup()
  })

  it('shows loading without rendering an empty state prematurely', () => {
    listMicrochipsMock.mockReturnValue(new Promise(() => undefined))

    render(<MicrochipInventoryPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando inventario')
    expect(screen.queryByText('No hay microchips registrados.')).not.toBeInTheDocument()
  })

  it('renders all normative status labels for inventory data', async () => {
    render(<MicrochipInventoryPage />)

    expect(await screen.findByText('990000015300168')).toBeInTheDocument()
    expect(screen.getByText('990000015300169')).toBeInTheDocument()
    expect(screen.getByText('880000000000001')).toBeInTheDocument()
    expect(screen.getByText('Disponible', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Implantado', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Bloqueado', { selector: 'span' })).toBeInTheDocument()
  })

  it('filters partially by code without numeric conversion', async () => {
    const user = userEvent.setup()
    render(<MicrochipInventoryPage />)

    await screen.findByText('990000015300168')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por código' }), '300168')

    expect(screen.getByText('990000015300168')).toBeInTheDocument()
    expect(screen.queryByText('990000015300169')).not.toBeInTheDocument()
    expect(screen.queryByText('880000000000001')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    render(<MicrochipInventoryPage />)

    await screen.findByText('990000015300168')
    await user.selectOptions(screen.getByLabelText('Estado'), 'blocked')

    expect(screen.getByText('880000000000001')).toBeInTheDocument()
    expect(screen.queryByText('990000015300168')).not.toBeInTheDocument()
  })

  it('combines a code query and status filter', async () => {
    const user = userEvent.setup()
    render(<MicrochipInventoryPage />)

    await screen.findByText('990000015300168')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por código' }), '990000')
    await user.selectOptions(screen.getByLabelText('Estado'), 'implanted')

    expect(screen.getByText('990000015300169')).toBeInTheDocument()
    expect(screen.queryByText('990000015300168')).not.toBeInTheDocument()
  })

  it('shows a filtered empty state and clears filters locally', async () => {
    const user = userEvent.setup()
    render(<MicrochipInventoryPage />)

    await screen.findByText('990000015300168')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por código' }), '777')

    expect(screen.getByText('No encontramos microchips con estos filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(screen.getByText('990000015300168')).toBeInTheDocument()
  })

  it('shows the global empty state when the RLS-visible inventory is empty', async () => {
    listMicrochipsMock.mockResolvedValue([])
    render(<MicrochipInventoryPage />)

    expect(await screen.findByText('No hay microchips registrados.')).toBeInTheDocument()
  })

  it('shows a safe error and retries the inventory query', async () => {
    const user = userEvent.setup()
    listMicrochipsMock.mockRejectedValueOnce(new Error('internal detail')).mockResolvedValueOnce(inventoryFixture)
    render(<MicrochipInventoryPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible cargar el inventario.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(listMicrochipsMock).toHaveBeenCalledTimes(2)
      expect(screen.getByText('990000015300168')).toBeInTheDocument()
    })
  })
})
