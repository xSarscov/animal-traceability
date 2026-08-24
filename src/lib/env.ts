import { z } from 'zod'

const environmentSchema = z.object({
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL debe ser una URL válida.'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY es obligatoria.'),
})

export type Environment = z.infer<typeof environmentSchema>

export function getEnvironment(): Environment {
  const result = environmentSchema.safeParse({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  })

  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join(' ')
    throw new Error(`Configuración de entorno inválida: ${details}`)
  }

  return result.data
}
