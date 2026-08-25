import { supabase } from '../../lib/supabase'

export type DashboardMetrics = {
  animals: number
  availableMicrochips: number
  implantedMicrochips: number
  lostAnimals: number
  pendingRecoveryReports: number
}

export class DashboardDataError extends Error {
  constructor() {
    super('No fue posible cargar el resumen.')
  }
}

export async function loadDashboardMetrics(): Promise<DashboardMetrics> {
  const animalsQuery = supabase
    .from('animals')
    .select('id', { count: 'exact', head: true })

  const availableMicrochipsQuery = supabase
    .from('microchips')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'available')

  const implantedMicrochipsQuery = supabase
    .from('microchips')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'implanted')

  const lostAnimalsQuery = supabase
    .from('animals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'lost')

  const pendingRecoveryReportsQuery = supabase
    .from('recovery_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const [animals, availableMicrochips, implantedMicrochips, lostAnimals, pendingRecoveryReports] = await Promise.all([
    animalsQuery,
    availableMicrochipsQuery,
    implantedMicrochipsQuery,
    lostAnimalsQuery,
    pendingRecoveryReportsQuery,
  ])

  return {
    animals: requireExactCount(animals),
    availableMicrochips: requireExactCount(availableMicrochips),
    implantedMicrochips: requireExactCount(implantedMicrochips),
    lostAnimals: requireExactCount(lostAnimals),
    pendingRecoveryReports: requireExactCount(pendingRecoveryReports),
  }
}

function requireExactCount(result: { count: number | null; error: unknown }): number {
  if (result.error || result.count === null) throw new DashboardDataError()
  return result.count
}
