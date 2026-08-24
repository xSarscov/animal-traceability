import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookupMicrochipByCode = vi.hoisted(() => vi.fn())

vi.mock('./microchip-lookup', () => ({ lookupMicrochipByCode }))

import { ScanPage } from './ScanPage'

function renderScanPage() {
  return render(
    <MemoryRouter initialEntries={['/scan']}>
      <Routes>
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/animals/:animalId" element={<p>Destino de animal</p>} />
        <Route path="/animals/new" element={<p>Registro futuro</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

describe('ScanPage', () => {
  beforeEach(() => {
    lookupMicrochipByCode.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a focused scanner input', () => {
    renderScanPage()

    expect(screen.getByLabelText('Código del microchip')).toHaveFocus()
    expect(screen.getByText('Listo para escanear.')).toBeInTheDocument()
  })

  it('uses the same form flow for Enter and normalizes outer whitespace', async () => {
    const user = userEvent.setup()
    lookupMicrochipByCode.mockResolvedValue({ kind: 'available', code: '990000015300168' })
    renderScanPage()

    await user.type(screen.getByLabelText('Código del microchip'), ' 990000015300168 {enter}')

    await waitFor(() => expect(lookupMicrochipByCode).toHaveBeenCalledWith('990000015300168'))
    expect(screen.getByLabelText('Código del microchip')).toHaveValue('')
    expect(screen.getByRole('link', { name: 'Registrar animal' })).toHaveAttribute(
      'href',
      '/animals/new?chip=990000015300168',
    )
  })

  it('uses the Buscar button through the same submit flow', async () => {
    const user = userEvent.setup()
    lookupMicrochipByCode.mockResolvedValue({ kind: 'unknown', code: '990000015300168' })
    renderScanPage()

    await user.type(screen.getByLabelText('Código del microchip'), '990000015300168')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(lookupMicrochipByCode).toHaveBeenCalledWith('990000015300168'))
    expect(screen.getByText('Microchip no reconocido')).toBeInTheDocument()
  })

  it('does not query Supabase for an invalid code', async () => {
    const user = userEvent.setup()
    renderScanPage()

    await user.type(screen.getByLabelText('Código del microchip'), '9900-001{enter}')

    expect(lookupMicrochipByCode).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un código numérico de entre 10 y 20 dígitos.')
  })

  it('shows searching while a lookup is pending', async () => {
    const user = userEvent.setup()
    const request = deferred<{ kind: 'unknown'; code: string }>()
    lookupMicrochipByCode.mockReturnValue(request.promise)
    renderScanPage()

    await user.type(screen.getByLabelText('Código del microchip'), '990000015300168{enter}')

    expect(screen.getByRole('status')).toHaveTextContent('Buscando microchip…')
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
    request.resolve({ kind: 'unknown', code: '990000015300168' })
    await screen.findByText('Microchip no reconocido')
  })

  it('shows available, blocked, and unknown outcomes without stale results', async () => {
    const user = userEvent.setup()
    lookupMicrochipByCode
      .mockResolvedValueOnce({ kind: 'available', code: '990000015300168' })
      .mockResolvedValueOnce({ kind: 'blocked', code: '990000015300169' })
      .mockResolvedValueOnce({ kind: 'unknown', code: '990000015300170' })
    renderScanPage()

    const input = screen.getByLabelText('Código del microchip')
    await user.type(input, '990000015300168{enter}')
    await screen.findByText('Microchip disponible')
    expect(input).toHaveFocus()

    await user.type(input, '990000015300169{enter}')
    await screen.findByText('Microchip bloqueado')
    expect(screen.queryByRole('link', { name: 'Registrar animal' })).not.toBeInTheDocument()
    expect(input).toHaveFocus()

    await user.type(input, '990000015300170{enter}')
    await screen.findByText('Microchip no reconocido')
    expect(input).toHaveFocus()
  })

  it('shows a safe error and retries the last valid code', async () => {
    const user = userEvent.setup()
    lookupMicrochipByCode
      .mockRejectedValueOnce(new Error('database failure'))
      .mockResolvedValueOnce({ kind: 'available', code: '990000015300168' })
    renderScanPage()

    await user.type(screen.getByLabelText('Código del microchip'), '990000015300168{enter}')
    await screen.findByText('No fue posible consultar el microchip.')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    await screen.findByText('Microchip disponible')
    expect(lookupMicrochipByCode).toHaveBeenNthCalledWith(2, '990000015300168')
  })

  it('navigates to the future animal profile after an implanted lookup', async () => {
    const user = userEvent.setup()
    lookupMicrochipByCode.mockResolvedValue({ kind: 'implanted', code: '990000015300168', animalId: 'animal-123' })
    renderScanPage()

    await user.type(screen.getByLabelText('Código del microchip'), '990000015300168{enter}')

    expect(await screen.findByText('Destino de animal')).toBeInTheDocument()
  })

  it('does not launch a second lookup while one is pending', async () => {
    const request = deferred<{ kind: 'unknown'; code: string }>()
    lookupMicrochipByCode.mockReturnValue(request.promise)
    renderScanPage()

    const form = screen.getByRole('button', { name: 'Buscar' }).closest('form')
    const input = screen.getByLabelText('Código del microchip')
    fireEvent.change(input, { target: { value: '990000015300168' } })
    fireEvent.submit(form!)
    fireEvent.submit(form!)

    expect(lookupMicrochipByCode).toHaveBeenCalledTimes(1)
    request.resolve({ kind: 'unknown', code: '990000015300168' })
  })
})
