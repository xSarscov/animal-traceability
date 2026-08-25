import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signOut = vi.hoisted(() => vi.fn())

vi.mock('../../features/auth/useAuth', () => ({ useAuth: () => ({ user: { email: 'staff@animal-traceability.test' } }) }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut } } }))

import { AppShell } from './AppShell'

describe('AppShell', () => {
  beforeEach(() => signOut.mockReset())

  it('includes the private recovery inbox navigation without introducing dashboard navigation', () => {
    render(
      <MemoryRouter initialEntries={['/recovery-reports']}>
        <Routes>
          <Route element={<AppShell />} path="/">
            <Route element={<p>Inbox</p>} path="recovery-reports" />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Escanear' })).toHaveAttribute('href', '/scan')
    expect(screen.getByRole('link', { name: 'Microchips' })).toHaveAttribute('href', '/microchips')
    expect(screen.getByRole('link', { name: 'Reportes' })).toHaveAttribute('href', '/recovery-reports')
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })
})
