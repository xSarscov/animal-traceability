import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }))

import {
  getRegistrationMicrochip,
  listOwnersForOrganization,
  registerAnimalWithChip,
  RegistrationDataError,
} from './animal-registration'

const values = {
  animalName: 'Luna',
  species: 'Perro',
  breed: null,
  sex: 'female' as const,
  birthDate: '',
  color: null,
  ownerMode: 'new' as const,
  existingOwnerId: '',
  ownerFullName: 'Propietario Demo',
  ownerPhone: null,
  ownerEmail: '',
  ownerAddress: null,
}

function queryReturning(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const order = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle, order })
  const select = vi.fn().mockReturnValue({ eq, order })
  return { builder: { select }, eq, order, select }
}

describe('animal registration data access', () => {
  beforeEach(() => {
    from.mockReset()
    rpc.mockReset()
  })

  it('preflights the microchip with a read-only exact lookup', async () => {
    const query = queryReturning({ data: { id: 'chip', code: '990000015300168', organization_id: 'org', status: 'available' }, error: null })
    from.mockReturnValue(query.builder)

    await expect(getRegistrationMicrochip('990000015300168')).resolves.toMatchObject({ code: '990000015300168', status: 'available' })
    expect(from).toHaveBeenCalledWith('microchips')
    expect(query.select).toHaveBeenCalledWith('id, code, status, organization_id')
    expect(query.eq).toHaveBeenCalledWith('code', '990000015300168')
  })

  it('lists owners by the preflight organization for UX only', async () => {
    const query = queryReturning({ data: [], error: null })
    from.mockReturnValue(query.builder)

    await expect(listOwnersForOrganization('org')).resolves.toEqual([])
    expect(from).toHaveBeenCalledWith('owners')
    expect(query.select).toHaveBeenCalledWith('id, full_name, phone, email')
    expect(query.eq).toHaveBeenCalledWith('organization_id', 'org')
    expect(query.order).toHaveBeenCalledWith('full_name', { ascending: true })
  })

  it('uses exactly one RPC for the registration write', async () => {
    rpc.mockResolvedValue({ data: 'animal-id', error: null })

    await expect(registerAnimalWithChip({ chipCode: '990000015300168', values })).resolves.toBe('animal-id')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('register_animal_with_chip', expect.objectContaining({
      p_chip_code: '990000015300168',
      p_animal_name: 'Luna',
      p_species: 'Perro',
      p_sex: 'female',
      p_existing_owner_id: null,
      p_owner_full_name: 'Propietario Demo',
    }))
    expect(from).not.toHaveBeenCalled()
  })

  it('maps backend errors to a safe application error', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'internal detail' } })

    await expect(registerAnimalWithChip({ chipCode: '990000015300168', values })).rejects.toMatchObject({ kind: 'unavailable' } satisfies Partial<RegistrationDataError>)
  })
})
