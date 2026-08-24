import type { Database } from '../../types/database.types'
import { supabase } from '../../lib/supabase'

export type MicrochipInventoryRow = Pick<
  Database['public']['Tables']['microchips']['Row'],
  'batch_code' | 'code' | 'frequency_khz' | 'standard' | 'status' | 'technology'
>

export async function listMicrochips(): Promise<MicrochipInventoryRow[]> {
  const { data, error } = await supabase
    .from('microchips')
    .select('code, technology, frequency_khz, standard, batch_code, status')
    .order('code', { ascending: true })

  if (error) {
    throw new Error('No fue posible cargar el inventario.')
  }

  return data ?? []
}
