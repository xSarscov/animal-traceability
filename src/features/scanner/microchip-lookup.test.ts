import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}))

import { lookupMicrochipByCode, MicrochipLookupError } from './microchip-lookup'

function queryReturning(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })

  return { builder: { select }, eq, maybeSingle, select }
}

describe('lookupMicrochipByCode', () => {
  beforeEach(() => {
    from.mockReset()
  })

  it('returns unknown when no visible microchip exists', async () => {
    const chipQuery = queryReturning({ data: null, error: null })
    from.mockReturnValue(chipQuery.builder)

    await expect(lookupMicrochipByCode('990000015300168')).resolves.toEqual({
      kind: 'unknown',
      code: '990000015300168',
    })
    expect(from).toHaveBeenCalledWith('microchips')
    expect(chipQuery.select).toHaveBeenCalledWith('id, code, status')
    expect(chipQuery.eq).toHaveBeenCalledWith('code', '990000015300168')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it.each(['available', 'blocked'] as const)('returns %s without querying animals', async (status) => {
    const chipQuery = queryReturning({ data: { id: 'chip-1', code: '990000015300168', status }, error: null })
    from.mockReturnValue(chipQuery.builder)

    await expect(lookupMicrochipByCode('990000015300168')).resolves.toEqual({ kind: status, code: '990000015300168' })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('resolves the associated animal only for an implanted microchip', async () => {
    const chipQuery = queryReturning({
      data: { id: 'chip-1', code: '990000015300168', status: 'implanted' },
      error: null,
    })
    const animalQuery = queryReturning({ data: { id: 'animal-1' }, error: null })
    from.mockReturnValueOnce(chipQuery.builder).mockReturnValueOnce(animalQuery.builder)

    await expect(lookupMicrochipByCode('990000015300168')).resolves.toEqual({
      kind: 'implanted',
      code: '990000015300168',
      animalId: 'animal-1',
    })
    expect(from).toHaveBeenNthCalledWith(1, 'microchips')
    expect(from).toHaveBeenNthCalledWith(2, 'animals')
    expect(animalQuery.select).toHaveBeenCalledWith('id')
    expect(animalQuery.eq).toHaveBeenCalledWith('microchip_id', 'chip-1')
  })

  it('fails safely when an implanted microchip has no associated animal', async () => {
    const chipQuery = queryReturning({
      data: { id: 'chip-1', code: '990000015300168', status: 'implanted' },
      error: null,
    })
    const animalQuery = queryReturning({ data: null, error: null })
    from.mockReturnValueOnce(chipQuery.builder).mockReturnValueOnce(animalQuery.builder)

    await expect(lookupMicrochipByCode('990000015300168')).rejects.toBeInstanceOf(MicrochipLookupError)
  })

  it('fails safely when Supabase returns an error', async () => {
    const chipQuery = queryReturning({ data: null, error: { message: 'internal database detail' } })
    from.mockReturnValue(chipQuery.builder)

    await expect(lookupMicrochipByCode('990000015300168')).rejects.toBeInstanceOf(MicrochipLookupError)
  })
})
