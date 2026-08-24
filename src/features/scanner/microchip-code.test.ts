import { describe, expect, it } from 'vitest'

import { normalizeMicrochipCode, validateMicrochipCode } from './microchip-code'

describe('microchip code normalization and validation', () => {
  it('trims outer whitespace without changing the code representation', () => {
    const normalized = normalizeMicrochipCode(' 990000015300168 ')

    expect(normalized).toBe('990000015300168')
    expect(validateMicrochipCode(normalized).success).toBe(true)
  })

  it.each(['990000015300168', '0000000001', '12345678901234567890'])('accepts valid numeric codes: %s', (code) => {
    expect(validateMicrochipCode(code).success).toBe(true)
  })

  it.each(['123456789', '123456789012345678901', '9900ABC', '9900-001'])('rejects invalid codes: %s', (code) => {
    expect(validateMicrochipCode(code).success).toBe(false)
  })
})
