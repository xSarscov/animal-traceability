import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getAnimalProfile = vi.hoisted(() => vi.fn())
const listAnimalEvents = vi.hoisted(() => vi.fn())
const createVaccinationEvent = vi.hoisted(() => vi.fn())
const createNoteEvent = vi.hoisted(() => vi.fn())

vi.mock('./animal-profile', () => ({
  getAnimalProfile,
  listAnimalEvents,
  createVaccinationEvent,
  createNoteEvent,
}))

import { AnimalProfilePage } from './AnimalProfilePage'

const animalId = '11111111-1111-4111-8111-111111111111'
const profile = {
  animal: { id: animalId, microchip_id: 'chip-id', owner_id: 'owner-id', name: 'Luna', species: 'Perro', breed: 'Mestiza', sex: 'female' as const, birth_date: '2023-01-10', color: 'Negro', status: 'active' as const, created_at: '2026-08-24T12:00:00Z' },
  microchip: { code: '990000015300168', technology: 'FDX-B', frequency_khz: 134.2, standard: 'ISO 11784/11785', batch_code: null, status: 'implanted' as const },
  owner: { full_name: 'Propietario Demo', phone: '5555', email: 'demo@example.test', address: 'Dirección demo' },
}
const events = [
  { id: 'event-note', event_type: 'note' as const, title: 'Revisión general', description: 'Animal registrado para demostración.', metadata: {}, occurred_at: '2026-08-24T14:00:00Z' },
  { id: 'event-vaccine', event_type: 'vaccination' as const, title: 'Vacunación: Rabia', description: null, metadata: { vaccine: 'Rabia', batch: 'DEMO-RAB-001', nextDose: '2027-08-24' }, occurred_at: '2026-08-24T13:00:00Z' },
  { id: 'event-implant', event_type: 'implantation' as const, title: 'Microchip implantado', description: null, metadata: {}, occurred_at: '2026-08-24T12:00:00Z' },
  { id: 'event-registration', event_type: 'registration' as const, title: 'Animal registrado', description: null, metadata: {}, occurred_at: '2026-08-24T11:00:00Z' },
]

function renderProfile(path = `/animals/${animalId}`) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/animals/:animalId" element={<AnimalProfilePage />} /></Routes></MemoryRouter>)
}

describe('AnimalProfilePage', () => {
  beforeEach(() => {
    getAnimalProfile.mockReset()
    listAnimalEvents.mockReset()
    createVaccinationEvent.mockReset()
    createNoteEvent.mockReset()
  })
  afterEach(cleanup)

  it('shows loading without profile data while the profile query is pending', () => {
    getAnimalProfile.mockReturnValue(new Promise(() => undefined))
    renderProfile()
    expect(screen.getByText('Cargando perfil…')).toBeInTheDocument()
    expect(screen.queryByText('Propietario Demo')).not.toBeInTheDocument()
  })

  it('renders private profile data, labels and a descending timeline', async () => {
    getAnimalProfile.mockResolvedValue(profile)
    listAnimalEvents.mockResolvedValue(events)
    renderProfile()
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    expect(screen.getByText('Perro · Hembra')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('990000015300168')).toBeInTheDocument()
    expect(screen.getByText('Propietario Demo')).toBeInTheDocument()
    expect(screen.getByText(/Vacuna: Rabia · Lote: DEMO-RAB-001/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Revisión general'), expect.stringContaining('Vacunación: Rabia'), expect.stringContaining('Microchip implantado'), expect.stringContaining('Animal registrado'),
    ]))
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Revisión general')
    expect(screen.queryByText('owner-id')).not.toBeInTheDocument()
  })

  it('does not query Supabase for an invalid UUID', async () => {
    renderProfile('/animals/not-a-uuid')
    expect(await screen.findByText('Animal no encontrado.')).toBeInTheDocument()
    expect(getAnimalProfile).not.toHaveBeenCalled()
  })

  it('shows not found for a visible-query miss', async () => {
    getAnimalProfile.mockResolvedValue(null)
    renderProfile()
    expect(await screen.findByText('Animal no encontrado.')).toBeInTheDocument()
  })

  it('retries a profile query after a safe error', async () => {
    const user = userEvent.setup()
    getAnimalProfile.mockRejectedValueOnce(new Error()).mockResolvedValueOnce(profile)
    listAnimalEvents.mockResolvedValue([])
    renderProfile()
    expect(await screen.findByText('No fue posible cargar el perfil.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    expect(getAnimalProfile).toHaveBeenCalledTimes(2)
  })

  it('creates a vaccination without audit fields and refreshes the timeline', async () => {
    const user = userEvent.setup()
    getAnimalProfile.mockResolvedValue(profile)
    listAnimalEvents.mockResolvedValueOnce(events).mockResolvedValueOnce([{ ...events[0], id: 'new-vaccine', title: 'Vacunación: Rabia' }, ...events])
    createVaccinationEvent.mockResolvedValue(undefined)
    renderProfile()
    await screen.findByRole('heading', { name: 'Luna' })
    await user.type(screen.getByLabelText('Vacuna *'), 'Rabia')
    await user.type(screen.getByLabelText('Lote'), 'DEMO-RAB-001')
    await user.click(screen.getByRole('button', { name: 'Registrar vacunación' }))
    await waitFor(() => expect(createVaccinationEvent).toHaveBeenCalledTimes(1))
    expect(createVaccinationEvent).toHaveBeenCalledWith({ animalId, values: { vaccine: 'Rabia', batch: 'DEMO-RAB-001', nextDose: null, description: null } })
    expect(await screen.findByText('Vacunación registrada.')).toBeInTheDocument()
    await waitFor(() => expect(listAnimalEvents).toHaveBeenCalledTimes(2))
  })

  it('validates and creates a note with empty metadata through the data boundary', async () => {
    const user = userEvent.setup()
    getAnimalProfile.mockResolvedValue(profile)
    listAnimalEvents.mockResolvedValue(events)
    createNoteEvent.mockResolvedValue(undefined)
    renderProfile()
    await screen.findByRole('heading', { name: 'Luna' })
    await user.click(screen.getByRole('button', { name: 'Agregar nota' }))
    expect(await screen.findByText('Ingresa un título para la nota.')).toBeInTheDocument()
    const noteSection = screen.getByRole('heading', { name: 'Agregar nota' }).closest('section')!
    await user.type(noteSection.querySelector('input')!, 'Control')
    await user.type(noteSection.querySelector('textarea')!, 'Todo bien')
    await user.click(screen.getByRole('button', { name: 'Agregar nota' }))
    await waitFor(() => expect(createNoteEvent).toHaveBeenCalledWith({ animalId, values: { title: 'Control', description: 'Todo bien' } }))
    expect(await screen.findByText('Nota agregada.')).toBeInTheDocument()
  })

  it('keeps vaccination input and shows a safe error when its write fails', async () => {
    const user = userEvent.setup()
    getAnimalProfile.mockResolvedValue(profile)
    listAnimalEvents.mockResolvedValue(events)
    createVaccinationEvent.mockRejectedValue(new Error())
    renderProfile()
    await screen.findByRole('heading', { name: 'Luna' })
    await user.type(screen.getByLabelText('Vacuna *'), 'Rabia')
    await user.click(screen.getByRole('button', { name: 'Registrar vacunación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible registrar la vacunación.')
    expect(screen.getByLabelText('Vacuna *')).toHaveValue('Rabia')
  })
})
