import { z } from 'zod'

const optionalText = z.string().transform((value) => value.trim() || null)

export const vaccinationEventSchema = z.object({
  vaccine: z.string().trim().min(1, 'Ingresa el nombre de la vacuna.'),
  batch: optionalText,
  nextDose: z.string().transform((value) => value || null),
  description: optionalText,
})

export const noteEventSchema = z.object({
  title: z.string().trim().min(1, 'Ingresa un título para la nota.'),
  description: optionalText,
})

export type VaccinationEventFormValues = z.input<typeof vaccinationEventSchema>
export type ParsedVaccinationEventFormValues = z.output<typeof vaccinationEventSchema>
export type NoteEventFormValues = z.input<typeof noteEventSchema>
export type ParsedNoteEventFormValues = z.output<typeof noteEventSchema>

export const vaccinationEventDefaultValues: VaccinationEventFormValues = {
  vaccine: '',
  batch: '',
  nextDose: '',
  description: '',
}

export const noteEventDefaultValues: NoteEventFormValues = {
  title: '',
  description: '',
}
