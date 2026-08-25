import { describe, expect, it, vi, beforeEach } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

import { getPublicAnimalByChip, PublicRecoverySubmitError, submitRecoveryReport } from './public-animal'

describe('public animal data access', () => {
  beforeEach(() => vi.resetAllMocks())

  it('uses only the limited lookup RPC and maps its public result', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { chip_code: '990000015300168', name: 'Luna', species: 'Perro', breed: null, sex: 'female', color: null, status: 'lost' }, error: null })
    rpc.mockReturnValue({ maybeSingle })

    await expect(getPublicAnimalByChip('990000015300168')).resolves.toEqual({ chipCode: '990000015300168', name: 'Luna', species: 'Perro', breed: null, sex: 'female', color: null, status: 'lost' })
    expect(rpc).toHaveBeenCalledWith('get_public_animal_by_chip', { p_chip_code: '990000015300168' })
  })

  it('returns null for zero public rows', async () => {
    rpc.mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })
    await expect(getPublicAnimalByChip('990000015300168')).resolves.toBeNull()
  })

  it('submits exactly the limited recovery RPC payload', async () => {
    rpc.mockResolvedValue({ error: null })
    await submitRecoveryReport({ chipCode: '990000015300168', reporterName: 'Persona', contact: 'Contacto', message: '' })
    expect(rpc).toHaveBeenCalledWith('submit_recovery_report', {
      p_chip_code: '990000015300168',
      p_reporter_name: 'Persona',
      p_contact: 'Contacto',
      p_message: '',
    })
  })

  it('maps a business conflict without exposing the backend error', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'internal' } })
    await expect(submitRecoveryReport({ chipCode: '990000015300168', reporterName: 'Persona', contact: 'Contacto', message: '' })).rejects.toMatchObject(new PublicRecoverySubmitError('unavailable'))
  })
})
