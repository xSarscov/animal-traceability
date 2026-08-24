import { supabase } from '../../lib/supabase'

export type MicrochipLookupResult =
  | { kind: 'unknown'; code: string }
  | { kind: 'available'; code: string }
  | { kind: 'blocked'; code: string }
  | { kind: 'implanted'; code: string; animalId: string }

export class MicrochipLookupError extends Error {
  constructor() {
    super('No fue posible consultar el microchip.')
  }
}

export async function lookupMicrochipByCode(code: string): Promise<MicrochipLookupResult> {
  const { data: microchip, error: microchipError } = await supabase
    .from('microchips')
    .select('id, code, status')
    .eq('code', code)
    .maybeSingle()

  if (microchipError) {
    throw new MicrochipLookupError()
  }

  if (!microchip) {
    return { kind: 'unknown', code }
  }

  if (microchip.status === 'available') {
    return { kind: 'available', code: microchip.code }
  }

  if (microchip.status === 'blocked') {
    return { kind: 'blocked', code: microchip.code }
  }

  if (microchip.status !== 'implanted') {
    throw new MicrochipLookupError()
  }

  const { data: animal, error: animalError } = await supabase
    .from('animals')
    .select('id')
    .eq('microchip_id', microchip.id)
    .maybeSingle()

  if (animalError || !animal) {
    throw new MicrochipLookupError()
  }

  return { kind: 'implanted', code: microchip.code, animalId: animal.id }
}
