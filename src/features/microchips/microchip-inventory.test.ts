import { describe, expect, it, vi } from 'vitest'

const queryMock = vi.hoisted(() => ({
  from: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: queryMock,
}))

import { listMicrochips } from './microchip-inventory'

describe('listMicrochips', () => {
  it('selects only inventory fields and orders by code', async () => {
    const rows = [
      {
        batch_code: null,
        code: '990000015300168',
        frequency_khz: 134.2,
        standard: 'ISO 11784/11785',
        status: 'available' as const,
        technology: 'FDX-B',
      },
    ]
    queryMock.order.mockResolvedValue({ data: rows, error: null })
    queryMock.select.mockReturnValue({ order: queryMock.order })
    queryMock.from.mockReturnValue({ select: queryMock.select })

    await expect(listMicrochips()).resolves.toEqual(rows)

    expect(queryMock.from).toHaveBeenCalledWith('microchips')
    expect(queryMock.select).toHaveBeenCalledWith(
      'code, technology, frequency_khz, standard, batch_code, status',
    )
    expect(queryMock.order).toHaveBeenCalledWith('code', { ascending: true })
  })

  it('returns a safe error when the read fails', async () => {
    queryMock.order.mockResolvedValue({ data: null, error: { message: 'internal detail' } })
    queryMock.select.mockReturnValue({ order: queryMock.order })
    queryMock.from.mockReturnValue({ select: queryMock.select })

    await expect(listMicrochips()).rejects.toThrow('No fue posible cargar el inventario.')
  })
})
