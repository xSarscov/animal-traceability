import { z } from 'zod'

const optionalText = z.string().transform((value) => value.trim() || null)

export const animalRegistrationSchema = z
  .object({
    animalName: z.string().trim().min(1, 'Ingresa el nombre del animal.'),
    species: z.string().trim().min(1, 'Ingresa la especie.'),
    breed: optionalText,
    sex: z.enum(['male', 'female', 'unknown']),
    birthDate: z.string(),
    color: optionalText,
    ownerMode: z.enum(['new', 'existing']),
    existingOwnerId: z.string(),
    ownerFullName: z.string().transform((value) => value.trim()),
    ownerPhone: optionalText,
    ownerEmail: z.string(),
    ownerAddress: optionalText,
  })
  .superRefine((value, context) => {
    if (value.ownerMode === 'existing' && !value.existingOwnerId) {
      context.addIssue({ code: 'custom', message: 'Selecciona un propietario.', path: ['existingOwnerId'] })
    }

    if (value.ownerMode === 'new' && !value.ownerFullName.trim()) {
      context.addIssue({ code: 'custom', message: 'Ingresa el nombre completo del propietario.', path: ['ownerFullName'] })
    }

    if (value.ownerMode === 'new' && value.ownerEmail.trim() && !z.string().email().safeParse(value.ownerEmail.trim()).success) {
      context.addIssue({ code: 'custom', message: 'Ingresa un email válido.', path: ['ownerEmail'] })
    }
  })

export type AnimalRegistrationFormValues = z.input<typeof animalRegistrationSchema>
export type ParsedAnimalRegistrationFormValues = z.output<typeof animalRegistrationSchema>

export const animalRegistrationDefaultValues: AnimalRegistrationFormValues = {
  animalName: '',
  species: '',
  breed: '',
  sex: 'unknown',
  birthDate: '',
  color: '',
  ownerMode: 'new',
  existingOwnerId: '',
  ownerFullName: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerAddress: '',
}
