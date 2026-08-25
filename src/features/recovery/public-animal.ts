import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database.types'

type PublicAnimalRow = Database['public']['Functions']['get_public_animal_by_chip']['Returns'][number]

export type PublicAnimal = {
  chipCode: PublicAnimalRow['chip_code']
  name: PublicAnimalRow['name']
  species: PublicAnimalRow['species']
  breed: PublicAnimalRow['breed']
  sex: PublicAnimalRow['sex']
  color: PublicAnimalRow['color']
  status: PublicAnimalRow['status']
}

export class PublicAnimalDataError extends Error {}

export class PublicRecoverySubmitError extends Error {
  readonly kind: 'unavailable' | 'generic'

  constructor(kind: 'unavailable' | 'generic') {
    super('No fue posible enviar el reporte.')
    this.kind = kind
  }
}

export async function getPublicAnimalByChip(chipCode: string): Promise<PublicAnimal | null> {
  const { data, error } = await supabase
    .rpc('get_public_animal_by_chip', { p_chip_code: chipCode })
    .maybeSingle()

  if (error) throw new PublicAnimalDataError()
  if (!data) return null

  return {
    chipCode: data.chip_code,
    name: data.name,
    species: data.species,
    breed: data.breed,
    sex: data.sex,
    color: data.color,
    status: data.status,
  }
}

export async function submitRecoveryReport(input: {
  chipCode: string
  reporterName: string
  contact: string
  message: string
}): Promise<void> {
  const { error } = await supabase.rpc('submit_recovery_report', {
    p_chip_code: input.chipCode,
    p_reporter_name: input.reporterName,
    p_contact: input.contact,
    p_message: input.message,
  })

  if (error) throw new PublicRecoverySubmitError(error.code === 'P0001' ? 'unavailable' : 'generic')
}
