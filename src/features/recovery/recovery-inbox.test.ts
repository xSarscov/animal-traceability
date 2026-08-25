import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }))

import {
  closeRecoveryReport,
  listRecoveryReports,
  markRecoveryReportReviewed,
  RecoveryInboxDataError,
  RecoveryReportTransitionError,
} from './recovery-inbox'

const report = {
  id: 'report-1',
  animal_id: 'animal-1',
  reporter_name: 'Persona Demo',
  contact: 'contacto@example.test',
  message: 'Encontré a Luna.',
  status: 'pending' as const,
  created_at: '2026-08-25T12:00:00Z',
}

function reportsQuery(result: unknown) {
  const order = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ order })
  return { builder: { select }, order, select }
}

function batchQuery(result: unknown) {
  const inQuery = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ in: inQuery })
  return { builder: { select }, inQuery, select }
}

describe('recovery inbox data access', () => {
  beforeEach(() => { from.mockReset(); rpc.mockReset() })

  it('reads reports, animals and microchips in three batched reads', async () => {
    const reports = reportsQuery({ data: [report], error: null })
    const animals = batchQuery({ data: [{ id: 'animal-1', name: 'Luna', status: 'lost', microchip_id: 'chip-1' }], error: null })
    const microchips = batchQuery({ data: [{ id: 'chip-1', code: '990000015300168' }], error: null })
    from.mockReturnValueOnce(reports.builder).mockReturnValueOnce(animals.builder).mockReturnValueOnce(microchips.builder)

    await expect(listRecoveryReports()).resolves.toEqual([{
      id: 'report-1', status: 'pending', reporterName: 'Persona Demo', contact: 'contacto@example.test', message: 'Encontré a Luna.', createdAt: '2026-08-25T12:00:00Z',
      animal: { id: 'animal-1', name: 'Luna', status: 'lost', microchipCode: '990000015300168' },
    }])
    expect(from).toHaveBeenNthCalledWith(1, 'recovery_reports')
    expect(reports.select).toHaveBeenCalledWith('id, animal_id, reporter_name, contact, message, status, created_at')
    expect(reports.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(from).toHaveBeenNthCalledWith(2, 'animals')
    expect(animals.select).toHaveBeenCalledWith('id, name, status, microchip_id')
    expect(animals.inQuery).toHaveBeenCalledWith('id', ['animal-1'])
    expect(from).toHaveBeenNthCalledWith(3, 'microchips')
    expect(microchips.select).toHaveBeenCalledWith('id, code')
    expect(microchips.inQuery).toHaveBeenCalledWith('id', ['chip-1'])
  })

  it('skips animal and microchip reads when no report is visible', async () => {
    const reports = reportsQuery({ data: [], error: null })
    from.mockReturnValueOnce(reports.builder)

    await expect(listRecoveryReports()).resolves.toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('fails safely if the visible report relation cannot be resolved', async () => {
    const reports = reportsQuery({ data: [report], error: null })
    const animals = batchQuery({ data: [], error: null })
    from.mockReturnValueOnce(reports.builder).mockReturnValueOnce(animals.builder)

    await expect(listRecoveryReports()).rejects.toBeInstanceOf(RecoveryInboxDataError)
  })

  it('uses only the reviewed RPC and validates its return value', async () => {
    rpc.mockResolvedValue({ data: 'reviewed', error: null })

    await expect(markRecoveryReportReviewed('report-1')).resolves.toBe('reviewed')
    expect(rpc).toHaveBeenCalledWith('mark_recovery_report_reviewed', { p_report_id: 'report-1' })
    expect(from).not.toHaveBeenCalled()
  })

  it('uses only the close RPC and rejects conflicts or unexpected results safely', async () => {
    rpc.mockResolvedValueOnce({ data: 'closed', error: null }).mockResolvedValueOnce({ data: null, error: { code: 'P0001' } }).mockResolvedValueOnce({ data: 'reviewed', error: null })

    await expect(closeRecoveryReport('report-1')).resolves.toBe('closed')
    await expect(closeRecoveryReport('report-1')).rejects.toMatchObject({ kind: 'conflict' })
    await expect(closeRecoveryReport('report-1')).rejects.toBeInstanceOf(RecoveryReportTransitionError)
    expect(rpc).toHaveBeenNthCalledWith(1, 'close_recovery_report', { p_report_id: 'report-1' })
    expect(from).not.toHaveBeenCalled()
  })
})
