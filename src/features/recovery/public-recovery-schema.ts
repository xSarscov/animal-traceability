import { z } from 'zod'

export const publicRecoverySchema = z.object({
  reporterName: z.string().trim().min(1, 'Ingresa tu nombre.').max(120, 'El nombre no puede superar 120 caracteres.'),
  contact: z.string().trim().min(1, 'Ingresa un medio de contacto.').max(200, 'El contacto no puede superar 200 caracteres.'),
  message: z.string().trim().max(1000, 'El mensaje no puede superar 1000 caracteres.'),
})

export type PublicRecoveryFormValues = z.input<typeof publicRecoverySchema>
export type ParsedPublicRecoveryFormValues = z.output<typeof publicRecoverySchema>

export const publicRecoveryDefaultValues: PublicRecoveryFormValues = {
  reporterName: '',
  contact: '',
  message: '',
}
