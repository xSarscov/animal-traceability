import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime } from './dates'

describe('dates', () => {
  it('formats valid dates in Spanish and handles invalid values defensively', () => {
    expect(formatDate('2026-09-10')).toContain('septiembre')
    expect(formatDateTime('2026-09-10T12:30:00Z')).toContain('septiembre')
    expect(formatDate('not-a-date')).toBe('—')
  })
})
