import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App bootstrap', () => {
  it('renders the routed application shell', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toHaveTextContent('Animal Traceability')
    expect(screen.getByText('MVP v0.1')).toBeInTheDocument()
  })
})
