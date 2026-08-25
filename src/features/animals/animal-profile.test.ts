import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }))

import { AnimalStatusChangeError, createNoteEvent, createVaccinationEvent, getAnimalProfile, listAnimalEvents, markAnimalFound, markAnimalLost } from './animal-profile'

function singleQuery(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  return { builder: { select }, select, eq }
}

describe('animal profile data access', () => {
  beforeEach(() => { from.mockReset(); rpc.mockReset() })

  it('loads only the private profile fields through RLS-protected individual queries', async () => {
    const animal = singleQuery({ data: { id: 'animal', microchip_id: 'chip', owner_id: 'owner' }, error: null })
    const chip = singleQuery({ data: { code: '990000015300168' }, error: null })
    const owner = singleQuery({ data: { full_name: 'Owner' }, error: null })
    from.mockReturnValueOnce(animal.builder).mockReturnValueOnce(chip.builder).mockReturnValueOnce(owner.builder)

    await expect(getAnimalProfile('animal')).resolves.toEqual({ animal: expect.any(Object), microchip: expect.any(Object), owner: expect.any(Object) })
    expect(from).toHaveBeenNthCalledWith(1, 'animals')
    expect(animal.select).toHaveBeenCalledWith('id, microchip_id, owner_id, name, species, breed, sex, birth_date, color, status, created_at')
    expect(animal.eq).toHaveBeenCalledWith('id', 'animal')
    expect(from).toHaveBeenNthCalledWith(2, 'microchips')
    expect(from).toHaveBeenNthCalledWith(3, 'owners')
  })

  it('orders the timeline by occurred_at descending', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    from.mockReturnValue({ select })
    await expect(listAnimalEvents('animal')).resolves.toEqual([])
    expect(from).toHaveBeenCalledWith('animal_events')
    expect(select).toHaveBeenCalledWith('id, event_type, title, description, metadata, occurred_at')
    expect(eq).toHaveBeenCalledWith('animal_id', 'animal')
    expect(order).toHaveBeenCalledWith('occurred_at', { ascending: false })
  })

  it('inserts only allowed vaccination fields and server owns audit fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    from.mockReturnValue({ insert })
    await createVaccinationEvent({ animalId: 'animal', values: { vaccine: 'Rabia', batch: 'LOT-1', nextDose: '2027-09-10', description: null } })
    expect(insert).toHaveBeenCalledWith({ animal_id: 'animal', event_type: 'vaccination', title: 'Vacunación: Rabia', description: null, metadata: { vaccine: 'Rabia', batch: 'LOT-1', nextDose: '2027-09-10' } })
    expect(insert.mock.calls[0][0]).not.toHaveProperty('performed_by')
    expect(insert.mock.calls[0][0]).not.toHaveProperty('occurred_at')
    expect(insert.mock.calls[0][0]).not.toHaveProperty('created_at')
  })

  it('inserts a note with empty metadata and no audit fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    from.mockReturnValue({ insert })
    await createNoteEvent({ animalId: 'animal', values: { title: 'Nota', description: null } })
    expect(insert).toHaveBeenCalledWith({ animal_id: 'animal', event_type: 'note', title: 'Nota', description: null, metadata: {} })
  })

  it('changes lost status only through the explicit mark_animal_lost RPC', async () => {
    rpc.mockResolvedValue({ data: 'lost', error: null })
    await expect(markAnimalLost('animal')).resolves.toBe('lost')
    expect(rpc).toHaveBeenCalledWith('mark_animal_lost', { p_animal_id: 'animal' })
    expect(from).not.toHaveBeenCalled()
  })

  it('changes found status only through the explicit mark_animal_found RPC', async () => {
    rpc.mockResolvedValue({ data: 'active', error: null })
    await expect(markAnimalFound('animal')).resolves.toBe('active')
    expect(rpc).toHaveBeenCalledWith('mark_animal_found', { p_animal_id: 'animal' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects an unexpected or conflicting status RPC result safely', async () => {
    rpc.mockResolvedValueOnce({ data: 'active', error: null }).mockResolvedValueOnce({ data: null, error: { code: 'P0001' } })
    await expect(markAnimalLost('animal')).rejects.toBeInstanceOf(AnimalStatusChangeError)
    await expect(markAnimalLost('animal')).rejects.toMatchObject({ kind: 'conflict' })
  })
})
