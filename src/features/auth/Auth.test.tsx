import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: authMock },
}))

import App from '../../app/App'
import { router } from '../../app/router'

const demoSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  expires_at: 2_000_000_000,
  token_type: 'bearer',
  user: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@animal-traceability.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  },
} as Session

describe('M3 authentication shell', () => {
  let authStateChangeListener: ((event: string, session: Session | null) => void) | undefined

  beforeEach(async () => {
    authStateChangeListener = undefined
    authMock.getSession.mockReset().mockResolvedValue({ data: { session: null } })
    authMock.signInWithPassword.mockReset().mockResolvedValue({ data: { session: null }, error: null })
    authMock.signOut.mockReset().mockResolvedValue({ error: null })
    authMock.onAuthStateChange.mockReset().mockImplementation((listener) => {
      authStateChangeListener = listener
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    await act(async () => {
      await router.navigate('/login')
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the login email and password fields', async () => {
    render(<App />)

    expect(await screen.findByRole('textbox', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('submits credentials through Supabase Auth', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'admin@animal-traceability.test')
    await user.type(screen.getByLabelText('Contraseña'), 'DemoAdmin123!')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => {
      expect(authMock.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@animal-traceability.test',
        password: 'DemoAdmin123!',
      })
    })
  })

  it('does not show private content while the session is loading', async () => {
    authMock.getSession.mockReturnValue(new Promise(() => undefined))

    await act(async () => {
      await router.navigate('/')
    })
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Comprobando sesión')
    expect(screen.queryByText('Animal Traceability')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor away from the private shell', async () => {
    await act(async () => {
      await router.navigate('/microchips')
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByText('Cerrar sesión')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor away from the scanner route', async () => {
    await act(async () => {
      await router.navigate('/scan')
    })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Escanear microchip' })).not.toBeInTheDocument()
  })

  it('allows an authenticated user to access the private shell', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: demoSession } })
    await act(async () => {
      await router.navigate('/')
    })
    render(<App />)

    expect(await screen.findByText('admin@animal-traceability.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('signs out and returns to the login route', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: demoSession } })
    authMock.signOut.mockImplementation(async () => {
      authStateChangeListener?.('SIGNED_OUT', null)
      return { error: null }
    })
    await act(async () => {
      await router.navigate('/')
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => {
      expect(authMock.signOut).toHaveBeenCalledOnce()
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    })
  })
})
