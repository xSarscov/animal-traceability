import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database.types'

import type { ParsedAnimalRegistrationFormValues } from './animal-registration-schema'

export type RegistrationMicrochip = Pick<
  Database['public']['Tables']['microchips']['Row'],
  'code' | 'id' | 'organization_id' | 'status'
>

export type ExistingOwner = Pick<Database['public']['Tables']['owners']['Row'], 'email' | 'full_name' | 'id' | 'phone'>

export class RegistrationDataError extends Error {
  readonly kind: 'generic' | 'unavailable'

  constructor(kind: 'generic' | 'unavailable') {
    super(kind === 'unavailable' ? 'El microchip ya no está disponible para registro.' : 'No fue posible completar el registro.')
    this.kind = kind
  }
}

export async function getRegistrationMicrochip(code: string): Promise<RegistrationMicrochip | null> {
  const { data, error } = await supabase
    .from('microchips')
    .select('id, code, status, organization_id')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    throw new RegistrationDataError('generic')
  }

  return data
}

export async function listOwnersForOrganization(organizationId: string): Promise<ExistingOwner[]> {
  const { data, error } = await supabase
    .from('owners')
    .select('id, full_name, phone, email')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true })

  if (error) {
    throw new RegistrationDataError('generic')
  }

  return data
}

export async function registerAnimalWithChip(input: {
  chipCode: string
  values: ParsedAnimalRegistrationFormValues
}): Promise<string> {
  const { values } = input
  const args = {
    p_chip_code: input.chipCode,
    p_animal_name: values.animalName,
    p_species: values.species,
    p_breed: values.breed,
    p_sex: values.sex,
    p_birth_date: values.birthDate || null,
    p_color: values.color,
    p_existing_owner_id: values.ownerMode === 'existing' ? values.existingOwnerId : null,
    p_owner_full_name: values.ownerMode === 'new' ? values.ownerFullName.trim() : null,
    p_owner_phone: values.ownerMode === 'new' ? values.ownerPhone : null,
    p_owner_email: values.ownerMode === 'new' ? values.ownerEmail.trim() || null : null,
    p_owner_address: values.ownerMode === 'new' ? values.ownerAddress : null,
  }

  const { data, error } = await supabase.rpc('register_animal_with_chip', args as never)

  if (error || !data) {
    throw new RegistrationDataError(error?.code === 'P0001' ? 'unavailable' : 'generic')
  }

  return data
}
