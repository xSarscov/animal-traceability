import { supabase } from '../../lib/supabase'
import type { Database, Json } from '../../types/database.types'

import type { ParsedNoteEventFormValues, ParsedVaccinationEventFormValues } from './animal-events-schema'

export type AnimalProfileAnimal = Pick<
  Database['public']['Tables']['animals']['Row'],
  'birth_date' | 'breed' | 'color' | 'created_at' | 'id' | 'microchip_id' | 'name' | 'owner_id' | 'sex' | 'species' | 'status'
>
export type AnimalProfileMicrochip = Pick<
  Database['public']['Tables']['microchips']['Row'],
  'batch_code' | 'code' | 'frequency_khz' | 'standard' | 'status' | 'technology'
>
export type AnimalProfileOwner = Pick<Database['public']['Tables']['owners']['Row'], 'address' | 'email' | 'full_name' | 'phone'>
export type AnimalEvent = Pick<
  Database['public']['Tables']['animal_events']['Row'],
  'description' | 'event_type' | 'id' | 'metadata' | 'occurred_at' | 'title'
>

export type AnimalProfile = {
  animal: AnimalProfileAnimal
  microchip: AnimalProfileMicrochip
  owner: AnimalProfileOwner
}

export class AnimalProfileDataError extends Error {}

export class AnimalStatusChangeError extends Error {
  readonly kind: 'conflict' | 'generic'

  constructor(kind: 'conflict' | 'generic') {
    super('No fue posible cambiar el estado del animal.')
    this.kind = kind
  }
}

export async function getAnimalProfile(animalId: string): Promise<AnimalProfile | null> {
  const { data: animal, error: animalError } = await supabase
    .from('animals')
    .select('id, microchip_id, owner_id, name, species, breed, sex, birth_date, color, status, created_at')
    .eq('id', animalId)
    .maybeSingle()

  if (animalError) throw new AnimalProfileDataError()
  if (!animal) return null

  const { data: microchip, error: microchipError } = await supabase
    .from('microchips')
    .select('code, technology, frequency_khz, standard, batch_code, status')
    .eq('id', animal.microchip_id)
    .maybeSingle()
  const { data: owner, error: ownerError } = await supabase
    .from('owners')
    .select('full_name, phone, email, address')
    .eq('id', animal.owner_id)
    .maybeSingle()

  if (microchipError || ownerError || !microchip || !owner) throw new AnimalProfileDataError()

  return { animal, microchip, owner }
}

export async function listAnimalEvents(animalId: string): Promise<AnimalEvent[]> {
  const { data, error } = await supabase
    .from('animal_events')
    .select('id, event_type, title, description, metadata, occurred_at')
    .eq('animal_id', animalId)
    .order('occurred_at', { ascending: false })

  if (error) throw new AnimalProfileDataError()
  return data
}

export async function createVaccinationEvent(input: {
  animalId: string
  values: ParsedVaccinationEventFormValues
}): Promise<void> {
  const metadata: Json = {
    vaccine: input.values.vaccine,
    ...(input.values.batch ? { batch: input.values.batch } : {}),
    ...(input.values.nextDose ? { nextDose: input.values.nextDose } : {}),
  }
  const { error } = await supabase.from('animal_events').insert({
    animal_id: input.animalId,
    event_type: 'vaccination',
    title: `Vacunación: ${input.values.vaccine}`,
    description: input.values.description,
    metadata,
  })
  if (error) throw new AnimalProfileDataError()
}

export async function createNoteEvent(input: {
  animalId: string
  values: ParsedNoteEventFormValues
}): Promise<void> {
  const { error } = await supabase.from('animal_events').insert({
    animal_id: input.animalId,
    event_type: 'note',
    title: input.values.title,
    description: input.values.description,
    metadata: {},
  })
  if (error) throw new AnimalProfileDataError()
}

export async function markAnimalLost(animalId: string): Promise<'lost'> {
  return changeAnimalStatus('mark_animal_lost', animalId, 'lost')
}

export async function markAnimalFound(animalId: string): Promise<'active'> {
  return changeAnimalStatus('mark_animal_found', animalId, 'active')
}

async function changeAnimalStatus<TExpectedStatus extends 'active' | 'lost'>(
  functionName: 'mark_animal_lost' | 'mark_animal_found',
  animalId: string,
  expectedStatus: TExpectedStatus,
): Promise<TExpectedStatus> {
  const { data, error } = await supabase.rpc(functionName, { p_animal_id: animalId })

  if (error) {
    throw new AnimalStatusChangeError(error.code === 'P0001' ? 'conflict' : 'generic')
  }
  if (data !== expectedStatus) throw new AnimalStatusChangeError('generic')

  return expectedStatus
}
