import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPublicAnimalByChip = vi.hoisted(() => vi.fn())
const submitRecoveryReport = vi.hoisted(() => vi.fn())
const PublicRecoverySubmitError = vi.hoisted(() => class PublicRecoverySubmitError extends Error {
  readonly kind: 'unavailable' | 'generic'
  constructor(kind: 'unavailable' | 'generic') { super('submit'); this.kind = kind }
})

vi.mock('./public-animal', () => ({ getPublicAnimalByChip, submitRecoveryReport, PublicRecoverySubmitError }))

import { PublicAnimalPage } from './PublicAnimalPage'

const lostAnimal = { chipCode: '990000015300168', name: 'Luna', species: 'Perro', breed: 'Mestiza', sex: 'female' as const, color: 'Canela', status: 'lost' as const }
const activeAnimal = { ...lostAnimal, name: 'Bruno', status: 'active' as const }
const deceasedAnimal = { ...lostAnimal, name: 'Nube', status: 'deceased' as const }

function renderPage(path = '/public/990000015300168') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/public/:chipCode" element={<PublicAnimalPage />} /></Routes></MemoryRouter>)
}
function NavigateTo({ target }: { target: string }) { const navigate = useNavigate(); return <button onClick={() => navigate(target)} type="button">Abrir B</button> }
function renderNavigablePage() {
  return render(<MemoryRouter initialEntries={['/public/990000015300168']}><NavigateTo target="/public/990000015300169" /><Routes><Route path="/public/:chipCode" element={<PublicAnimalPage />} /></Routes></MemoryRouter>)
}

describe('PublicAnimalPage', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => cleanup())

  it('does not call the public RPC for an invalid route code', () => {
    renderPage('/public/not-valid')
    expect(screen.getByText('Microchip no encontrado.')).toBeInTheDocument()
    expect(getPublicAnimalByChip).not.toHaveBeenCalled()
  })

  it('renders loading without requiring an authenticated shell', () => {
    getPublicAnimalByChip.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Cargando información…')).toBeInTheDocument()
  })

  it('renders only public data and the lost recovery form', async () => {
    getPublicAnimalByChip.mockResolvedValue(lostAnimal)
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    expect(screen.getByText('Hembra')).toBeInTheDocument()
    expect(screen.getByText('Animal reportado como perdido')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Encontré este animal' })).toBeInTheDocument()
    expect(screen.queryByText('PRIVATE OWNER CANARY')).not.toBeInTheDocument()
  })

  it('does not show the recovery form for active or deceased profiles', async () => {
    getPublicAnimalByChip.mockResolvedValueOnce(activeAnimal).mockResolvedValueOnce(deceasedAnimal)
    const view = renderPage()
    expect((await screen.findAllByText('Activo')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Encontré este animal' })).not.toBeInTheDocument()
    view.unmount()
    renderPage()
    expect((await screen.findAllByText('Fallecido')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Encontré este animal' })).not.toBeInTheDocument()
  })

  it('renders not found and retries a failed lookup safely', async () => {
    const user = userEvent.setup()
    getPublicAnimalByChip.mockRejectedValueOnce(new Error('backend')).mockResolvedValueOnce(lostAnimal)
    renderPage()
    expect(await screen.findByText('No fue posible consultar el microchip.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
  })

  it('validates the public form and submits only its safe payload', async () => {
    const user = userEvent.setup()
    getPublicAnimalByChip.mockResolvedValue(lostAnimal)
    submitRecoveryReport.mockResolvedValue(undefined)
    renderPage()
    await screen.findByRole('heading', { name: 'Encontré este animal' })
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }))
    expect(await screen.findByText('Ingresa tu nombre.')).toBeInTheDocument()
    expect(submitRecoveryReport).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Nombre *'), ' Persona Demo ')
    await user.type(screen.getByLabelText('Contacto *'), ' contacto@example.test ')
    await user.type(screen.getByLabelText('Mensaje'), ' Encontré a Luna ')
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }))
    await waitFor(() => expect(submitRecoveryReport).toHaveBeenCalledWith({ chipCode: '990000015300168', reporterName: 'Persona Demo', contact: 'contacto@example.test', message: 'Encontré a Luna' }))
    expect(await screen.findByText('Reporte enviado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).not.toBeInTheDocument()
  })

  it('keeps form values on a technical submit error', async () => {
    const user = userEvent.setup()
    getPublicAnimalByChip.mockResolvedValue(lostAnimal)
    submitRecoveryReport.mockRejectedValue(new Error('backend'))
    renderPage()
    await screen.findByRole('heading', { name: 'Encontré este animal' })
    await user.type(screen.getByLabelText('Nombre *'), 'Persona')
    await user.type(screen.getByLabelText('Contacto *'), 'Contacto')
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible enviar el reporte.')
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Persona')
  })

  it('refreshes the profile instead of claiming success when lost became active', async () => {
    const user = userEvent.setup()
    getPublicAnimalByChip.mockResolvedValueOnce(lostAnimal).mockResolvedValueOnce(activeAnimal)
    submitRecoveryReport.mockRejectedValue(new PublicRecoverySubmitError('unavailable'))
    renderPage()
    await screen.findByRole('heading', { name: 'Encontré este animal' })
    await user.type(screen.getByLabelText('Nombre *'), 'Persona')
    await user.type(screen.getByLabelText('Contacto *'), 'Contacto')
    await user.click(screen.getByRole('button', { name: 'Enviar reporte' }))
    expect((await screen.findAllByText('Activo')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Encontré este animal' })).not.toBeInTheDocument()
    expect(screen.queryByText('Reporte enviado.')).not.toBeInTheDocument()
  })

  it('immediately unmounts public A while public B is loading', async () => {
    const user = userEvent.setup()
    let resolveB: ((value: typeof activeAnimal) => void) | undefined
    getPublicAnimalByChip.mockImplementation((code: string) => code === '990000015300168' ? Promise.resolve(lostAnimal) : new Promise((resolve) => { resolveB = resolve }))
    renderNavigablePage()
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir B' }))
    expect(screen.getByText('Cargando información…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Luna' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Encontré este animal' })).not.toBeInTheDocument()
    resolveB?.(activeAnimal)
    expect(await screen.findByRole('heading', { name: 'Bruno' })).toBeInTheDocument()
  })

  it('does not reveal public A if public B resolves as not found', async () => {
    const user = userEvent.setup()
    let resolveB: ((value: null) => void) | undefined
    getPublicAnimalByChip.mockImplementation((code: string) => code === '990000015300168' ? Promise.resolve(lostAnimal) : new Promise((resolve) => { resolveB = resolve }))
    renderNavigablePage()
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir B' }))
    expect(screen.getByText('Cargando información…')).toBeInTheDocument()
    expect(screen.queryByText('Luna')).not.toBeInTheDocument()
    resolveB?.(null)
    expect(await screen.findByText('Microchip no encontrado.')).toBeInTheDocument()
  })
})
