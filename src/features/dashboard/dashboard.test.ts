import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({ supabase: { from } }))

import { DashboardDataError, loadDashboardMetrics } from './dashboard'

const selectOptions = { count: 'exact', head: true }

function countQuery(result: unknown) {
  const eq = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ eq })
  return { builder: { select }, eq, select }
}

describe('dashboard data access', () => {
  beforeEach(() => from.mockReset())

  it('builds the five exact count queries before awaiting their results', async () => {
    const animals = countQuery({ count: 12, error: null })
    const available = countQuery({ count: 50, error: null })
    const implanted = countQuery({ count: 12, error: null })
    const lost = countQuery({ count: 3, error: null })
    const pending = countQuery({ count: 4, error: null })
    animals.select.mockReturnValueOnce(Promise.resolve({ count: 12, error: null }))
    from
      .mockReturnValueOnce(animals.builder)
      .mockReturnValueOnce(available.builder)
      .mockReturnValueOnce(implanted.builder)
      .mockReturnValueOnce(lost.builder)
      .mockReturnValueOnce(pending.builder)

    await expect(loadDashboardMetrics()).resolves.toEqual({
      animals: 12,
      availableMicrochips: 50,
      implantedMicrochips: 12,
      lostAnimals: 3,
      pendingRecoveryReports: 4,
    })

    expect(from).toHaveBeenNthCalledWith(1, 'animals')
    expect(animals.select).toHaveBeenCalledWith('id', selectOptions)
    expect(from).toHaveBeenNthCalledWith(2, 'microchips')
    expect(available.select).toHaveBeenCalledWith('id', selectOptions)
    expect(available.eq).toHaveBeenCalledWith('status', 'available')
    expect(from).toHaveBeenNthCalledWith(3, 'microchips')
    expect(implanted.select).toHaveBeenCalledWith('id', selectOptions)
    expect(implanted.eq).toHaveBeenCalledWith('status', 'implanted')
    expect(from).toHaveBeenNthCalledWith(4, 'animals')
    expect(lost.select).toHaveBeenCalledWith('id', selectOptions)
    expect(lost.eq).toHaveBeenCalledWith('status', 'lost')
    expect(from).toHaveBeenNthCalledWith(5, 'recovery_reports')
    expect(pending.select).toHaveBeenCalledWith('id', selectOptions)
    expect(pending.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('accepts zero as a valid exact count', async () => {
    const animals = countQuery({ count: 0, error: null })
    const available = countQuery({ count: 0, error: null })
    const implanted = countQuery({ count: 0, error: null })
    const lost = countQuery({ count: 0, error: null })
    const pending = countQuery({ count: 0, error: null })
    animals.select.mockReturnValueOnce(Promise.resolve({ count: 0, error: null }))
    from
      .mockReturnValueOnce(animals.builder)
      .mockReturnValueOnce(available.builder)
      .mockReturnValueOnce(implanted.builder)
      .mockReturnValueOnce(lost.builder)
      .mockReturnValueOnce(pending.builder)

    await expect(loadDashboardMetrics()).resolves.toEqual({
      animals: 0,
      availableMicrochips: 0,
      implantedMicrochips: 0,
      lostAnimals: 0,
      pendingRecoveryReports: 0,
    })
  })

  it.each([
    [{ count: 1, error: new Error('backend') }, { count: 1, error: null }, { count: 1, error: null }, { count: 1, error: null }, { count: 1, error: null }],
    [{ count: 1, error: null }, { count: null, error: null }, { count: 1, error: null }, { count: 1, error: null }, { count: 1, error: null }],
  ])('fails safely when any query has an error or a null count', async (...results) => {
    const [animalsResult, availableResult, implantedResult, lostResult, pendingResult] = results
    const animals = countQuery(animalsResult)
    const available = countQuery(availableResult)
    const implanted = countQuery(implantedResult)
    const lost = countQuery(lostResult)
    const pending = countQuery(pendingResult)
    animals.select.mockReturnValueOnce(Promise.resolve(animalsResult))
    from
      .mockReturnValueOnce(animals.builder)
      .mockReturnValueOnce(available.builder)
      .mockReturnValueOnce(implanted.builder)
      .mockReturnValueOnce(lost.builder)
      .mockReturnValueOnce(pending.builder)

    await expect(loadDashboardMetrics()).rejects.toBeInstanceOf(DashboardDataError)
  })
})
