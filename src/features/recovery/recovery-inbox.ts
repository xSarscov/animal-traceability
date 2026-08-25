import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database.types'

type RecoveryReportRow = Pick<
  Database['public']['Tables']['recovery_reports']['Row'],
  'animal_id' | 'contact' | 'created_at' | 'id' | 'message' | 'reporter_name' | 'status'
>
type InboxAnimalRow = Pick<Database['public']['Tables']['animals']['Row'], 'id' | 'microchip_id' | 'name' | 'status'>
type InboxMicrochipRow = Pick<Database['public']['Tables']['microchips']['Row'], 'code' | 'id'>

export type RecoveryInboxItem = {
  id: RecoveryReportRow['id']
  status: RecoveryReportRow['status']
  reporterName: RecoveryReportRow['reporter_name']
  contact: RecoveryReportRow['contact']
  message: RecoveryReportRow['message']
  createdAt: RecoveryReportRow['created_at']
  animal: {
    id: InboxAnimalRow['id']
    name: InboxAnimalRow['name']
    status: InboxAnimalRow['status']
    microchipCode: InboxMicrochipRow['code']
  }
}

export class RecoveryInboxDataError extends Error {}

export class RecoveryReportTransitionError extends Error {
  readonly kind: 'conflict' | 'generic'

  constructor(kind: 'conflict' | 'generic') {
    super('No fue posible actualizar el reporte.')
    this.kind = kind
  }
}

export async function listRecoveryReports(): Promise<RecoveryInboxItem[]> {
  const { data: reports, error: reportsError } = await supabase
    .from('recovery_reports')
    .select('id, animal_id, reporter_name, contact, message, status, created_at')
    .order('created_at', { ascending: false })

  if (reportsError) throw new RecoveryInboxDataError()
  if (!reports || reports.length === 0) return []

  const animalIds = [...new Set(reports.map((report) => report.animal_id))]
  const { data: animals, error: animalsError } = await supabase
    .from('animals')
    .select('id, name, status, microchip_id')
    .in('id', animalIds)

  if (animalsError || !animals) throw new RecoveryInboxDataError()

  const animalsById = new Map(animals.map((animal) => [animal.id, animal]))
  if (reports.some((report) => !animalsById.has(report.animal_id))) throw new RecoveryInboxDataError()

  const microchipIds = [...new Set(animals.map((animal) => animal.microchip_id))]
  const { data: microchips, error: microchipsError } = await supabase
    .from('microchips')
    .select('id, code')
    .in('id', microchipIds)

  if (microchipsError || !microchips) throw new RecoveryInboxDataError()

  const microchipsById = new Map(microchips.map((microchip) => [microchip.id, microchip]))

  return reports.map((report) => {
    const animal = animalsById.get(report.animal_id)
    const microchip = animal ? microchipsById.get(animal.microchip_id) : undefined

    if (!animal || !microchip) throw new RecoveryInboxDataError()

    return {
      id: report.id,
      status: report.status,
      reporterName: report.reporter_name,
      contact: report.contact,
      message: report.message,
      createdAt: report.created_at,
      animal: {
        id: animal.id,
        name: animal.name,
        status: animal.status,
        microchipCode: microchip.code,
      },
    }
  })
}

export async function markRecoveryReportReviewed(reportId: string): Promise<'reviewed'> {
  const { data, error } = await supabase.rpc('mark_recovery_report_reviewed', { p_report_id: reportId })

  if (error) throw new RecoveryReportTransitionError(error.code === 'P0001' ? 'conflict' : 'generic')
  if (data !== 'reviewed') throw new RecoveryReportTransitionError('generic')

  return data
}

export async function closeRecoveryReport(reportId: string): Promise<'closed'> {
  const { data, error } = await supabase.rpc('close_recovery_report', { p_report_id: reportId })

  if (error) throw new RecoveryReportTransitionError(error.code === 'P0001' ? 'conflict' : 'generic')
  if (data !== 'closed') throw new RecoveryReportTransitionError('generic')

  return data
}
