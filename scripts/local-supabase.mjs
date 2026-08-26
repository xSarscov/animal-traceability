import { loadEnv } from 'vite'

const localHostnames = new Set(['127.0.0.1', 'localhost'])

export function getLocalSupabaseEnvironment() {
  const env = loadEnv('development', process.cwd(), '')
  const url = env.VITE_SUPABASE_URL
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY para ejecutar la QA local.')
  }

  let parsedUrl

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('VITE_SUPABASE_URL no es una URL válida para la QA local.')
  }

  if (!localHostnames.has(parsedUrl.hostname)) {
    throw new Error('Los E2E destructivos solo pueden ejecutarse contra Supabase local.')
  }

  return {
    publishableKey,
    url: parsedUrl.toString().replace(/\/$/, ''),
  }
}
