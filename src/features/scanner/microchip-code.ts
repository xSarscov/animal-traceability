import { z } from 'zod'

const microchipCodeSchema = z
  .string()
  .regex(/^\d{10,20}$/, 'Ingresa un código numérico de entre 10 y 20 dígitos.')

export function normalizeMicrochipCode(value: string): string {
  return value.trim()
}

export function validateMicrochipCode(code: string) {
  return microchipCodeSchema.safeParse(code)
}
