import { format, isValid, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(date: Date | string): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return isValid(parsed) ? format(parsed, 'PPP', { locale: es }) : '—'
}

export function formatDateTime(date: Date | string): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return isValid(parsed) ? format(parsed, "PPP, p", { locale: es }) : '—'
}
