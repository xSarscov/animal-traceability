import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getRegistrationMicrochip = vi.hoisted(() => vi.fn())
const listOwnersForOrganization = vi.hoisted(() => vi.fn())
const registerAnimalWithChip = vi.hoisted(() => vi.fn())

vi.mock('./animal-registration', () => ({
  getRegistrationMicrochip,
  listOwnersForOrganization,
  registerAnimalWithChip,
}))

import { AnimalRegistrationPage } from './AnimalRegistrationPage'

const availableChip = { id: 'chip-id', code: '990000015300168', organization_id: 'org-id', status: 'available' as const }
const availableChipB = { id: 'chip-id-b', code: '990000015300169', organization_id: 'org-id-b', status: 'available' as const }

function renderPage(path = '/animals/new?chip=990000015300168') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/animals/new" element={<AnimalRegistrationPage />} /><Route path="/scan" element={<p>Escáner</p>} /></Routes>
    </MemoryRouter>,
  )
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function SearchParamChangeHarness() {
  const navigate = useNavigate()

  return (
    <>
      <button type="button" onClick={() => navigate(`/animals/new?chip=${availableChipB.code}`)}>Cambiar a chip B</button>
      <AnimalRegistrationPage />
    </>
  )
}

describe('AnimalRegistrationPage', () => {
  beforeEach(() => {
    getRegistrationMicrochip.mockReset()
    listOwnersForOrganization.mockReset().mockResolvedValue([])
    registerAnimalWithChip.mockReset()
  })

  afterEach(cleanup)

  it.each([
    ['/animals/new', 'Escanea primero un microchip disponible.'],
    ['/animals/new?chip=bad', 'El código del microchip no es válido.'],
  ])('does not show a form for missing or invalid chip parameters', async (path, message) => {
    renderPage(path)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(getRegistrationMicrochip).not.toHaveBeenCalled()
  })

  it.each([
    [null, 'Microchip no reconocido.'],
    [{ ...availableChip, status: 'blocked' }, 'Microchip bloqueado.'],
    [{ ...availableChip, status: 'implanted' }, 'Este microchip ya está implantado.'],
  ])('blocks registration when the preflight result is not available', async (result, message) => {
    getRegistrationMicrochip.mockResolvedValue(result)
    renderPage()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar animal' })).not.toBeInTheDocument()
  })

  it('renders the available registration form and validates required fields', async () => {
    const user = userEvent.setup()
    getRegistrationMicrochip.mockResolvedValue(availableChip)
    renderPage()
    await screen.findByText('Disponible')

    expect(screen.getByLabelText('Nombre *')).toBeInTheDocument()
    expect(screen.getByLabelText('Especie *')).toBeInTheDocument()
    expect(screen.getByLabelText('Sexo *')).toHaveValue('unknown')
    await user.click(screen.getByRole('button', { name: 'Registrar animal' }))
    expect(await screen.findByText('Ingresa el nombre del animal.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa la especie.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa el nombre completo del propietario.')).toBeInTheDocument()
    expect(registerAnimalWithChip).not.toHaveBeenCalled()
  })

  it('clears stale preflight state immediately when the chip query parameter changes', async () => {
    const user = userEvent.setup()
    const chipARequest = deferred<typeof availableChip | null>()
    const chipBRequest = deferred<typeof availableChipB | null>()
    getRegistrationMicrochip.mockImplementation((code: string) => code === availableChip.code ? chipARequest.promise : chipBRequest.promise)

    render(
      <MemoryRouter initialEntries={[`/animals/new?chip=${availableChip.code}`]}>
        <Routes><Route path="/animals/new" element={<SearchParamChangeHarness />} /><Route path="/scan" element={<p>Escáner</p>} /></Routes>
      </MemoryRouter>,
    )

    chipARequest.resolve(availableChip)
    expect(await screen.findByText(availableChip.code)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar animal' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cambiar a chip B' }))

    expect(screen.getByRole('heading', { name: 'Comprobando microchip…' })).toBeInTheDocument()
    expect(screen.queryByText(availableChip.code)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar animal' })).not.toBeInTheDocument()

    chipBRequest.resolve(availableChipB)
    expect(await screen.findByText(availableChipB.code)).toBeInTheDocument()
    expect(screen.queryByText(availableChip.code)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar animal' })).toBeInTheDocument()
  })

  it('loads existing owners only when that mode is selected', async () => {
    const user = userEvent.setup()
    getRegistrationMicrochip.mockResolvedValue(availableChip)
    listOwnersForOrganization.mockResolvedValue([{ id: 'owner-1', full_name: 'Owner One', phone: '5555', email: 'owner@example.test' }])
    renderPage()
    await screen.findByText('Disponible')
    expect(listOwnersForOrganization).not.toHaveBeenCalled()

    await user.click(screen.getByLabelText('Propietario existente'))
    expect(await screen.findByRole('option', { name: /Owner One/ })).toBeInTheDocument()
    expect(listOwnersForOrganization).toHaveBeenCalledWith('org-id')
  })

  it('submits normalized values through the single registration RPC and shows success', async () => {
    const user = userEvent.setup()
    getRegistrationMicrochip.mockResolvedValue(availableChip)
    registerAnimalWithChip.mockResolvedValue('animal-id')
    renderPage()
    await screen.findByText('Disponible')

    await user.type(screen.getByLabelText('Nombre *'), ' Luna ')
    await user.type(screen.getByLabelText('Especie *'), ' Perro ')
    await user.selectOptions(screen.getByLabelText('Sexo *'), 'female')
    await user.type(screen.getByLabelText('Nombre completo *'), ' Propietario Demo ')
    await user.type(screen.getByLabelText('Email'), 'demo@example.test')
    await user.click(screen.getByRole('button', { name: 'Registrar animal' }))

    await waitFor(() => expect(registerAnimalWithChip).toHaveBeenCalledTimes(1))
    expect(registerAnimalWithChip).toHaveBeenCalledWith(expect.objectContaining({ chipCode: '990000015300168', values: expect.objectContaining({ animalName: 'Luna', species: 'Perro', sex: 'female', ownerFullName: 'Propietario Demo' }) }))
    expect(await screen.findByText('Animal registrado')).toBeInTheDocument()
    expect(screen.getByText(/Luna quedó asociado al microchip 990000015300168/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver perfil' })).toHaveAttribute('href', '/animals/animal-id')
    expect(screen.getByRole('link', { name: 'Volver a escanear' })).toHaveAttribute('href', '/scan')
  })

  it('disables duplicate submit while the registration request is pending', async () => {
    const user = userEvent.setup()
    const request = deferred<string>()
    getRegistrationMicrochip.mockResolvedValue(availableChip)
    registerAnimalWithChip.mockReturnValue(request.promise)
    renderPage()
    await screen.findByText('Disponible')
    await user.type(screen.getByLabelText('Nombre *'), 'Luna')
    await user.type(screen.getByLabelText('Especie *'), 'Perro')
    await user.type(screen.getByLabelText('Nombre completo *'), 'Propietario Demo')
    await user.click(screen.getByRole('button', { name: 'Registrar animal' }))

    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled()
    request.resolve('animal-id')
    await screen.findByText('Animal registrado')
  })

  it('shows a safe business error when the microchip becomes unavailable', async () => {
    const user = userEvent.setup()
    getRegistrationMicrochip.mockResolvedValue(availableChip)
    registerAnimalWithChip.mockRejectedValue(new Error('El microchip ya no está disponible para registro.'))
    renderPage()
    await screen.findByText('Disponible')
    await user.type(screen.getByLabelText('Nombre *'), 'Luna')
    await user.type(screen.getByLabelText('Especie *'), 'Perro')
    await user.type(screen.getByLabelText('Nombre completo *'), 'Propietario Demo')
    await user.click(screen.getByRole('button', { name: 'Registrar animal' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El microchip ya no está disponible para registro. Vuelve a escanearlo.')
  })
})
