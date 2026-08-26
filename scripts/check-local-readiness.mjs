import { createClient } from '@supabase/supabase-js'

import { getLocalSupabaseEnvironment } from './local-supabase.mjs'

const demoChipCode = '990000015300168'
const staffCredentials = {
  email: 'staff@animal-traceability.test',
  password: 'DemoStaff123!',
}
const readinessTimeoutMs = 90_000
const pollIntervalMs = 1_000
const loginRetryIntervalMs = 5_000
const requestTimeoutMs = 5_000
const requiredStableChecks = 15

class DirtyDemoStateError extends Error {}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function createLocalClient(url, publishableKey) {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

async function isAuthHealthy(url) {
  const response = await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(requestTimeoutMs) })
  return response.ok
}

async function withTimeout(promise, label) {
  let timeoutId

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} excedió ${requestTimeoutMs / 1000} s.`)), requestTimeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

function requireExactCount(result) {
  if (result.error || result.count === null) {
    throw new Error('PostgREST todavía no devolvió un count exacto válido.')
  }

  return result.count
}

async function assertCleanDemoState(client) {
  const [animals, availableMicrochips, implantedMicrochips, lostAnimals, pendingRecoveryReports] = await Promise.all([
    client.from('animals').select('id', { count: 'exact', head: true }),
    client.from('microchips').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    client.from('microchips').select('id', { count: 'exact', head: true }).eq('status', 'implanted'),
    client.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'lost'),
    client.from('recovery_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const metrics = [
    requireExactCount(animals),
    requireExactCount(availableMicrochips),
    requireExactCount(implantedMicrochips),
    requireExactCount(lostAnimals),
    requireExactCount(pendingRecoveryReports),
  ]
  const expected = [0, 1, 0, 0, 0]

  if (metrics.some((metric, index) => metric !== expected[index])) {
    throw new DirtyDemoStateError('El entorno local está listo pero no está limpio. Ejecuta `supabase db reset` antes de los E2E.')
  }

  return metrics
}

async function assertAuthenticatedPostgrestReady(client) {
  const { data, error } = await client
    .from('microchips')
    .select('code, status')
    .eq('code', demoChipCode)
    .maybeSingle()

  if (error || !data || data.code !== demoChipCode || data.status !== 'available') {
    throw new Error('PostgREST autenticado todavía no puede comprobar el microchip demo.')
  }
}

async function assertAnonymousPostgrestReady(url, publishableKey) {
  const anonymousClient = createLocalClient(url, publishableKey)
  const { data, error } = await anonymousClient.rpc('get_public_animal_by_chip', { p_chip_code: demoChipCode })

  if (error || !Array.isArray(data) || data.length !== 0) {
    throw new Error('PostgREST anónimo todavía no validó el contrato público limpio.')
  }
}

async function main() {
  const { publishableKey, url } = getLocalSupabaseEnvironment()
  const deadline = Date.now() + readinessTimeoutMs
  const client = createLocalClient(url, publishableKey)
  let authReady = false
  let authenticated = false
  let completedStableChecks = 0
  let lastLoginAttemptAt = 0
  let lastError = 'Los servicios locales aún no responden.'

  while (Date.now() < deadline) {
    try {
      if (!authReady) {
        authReady = await isAuthHealthy(url)
        if (!authReady) {
          throw new Error('Auth HTTP aún no está listo.')
        }
      }

      if (!authenticated) {
        const now = Date.now()
        if (now - lastLoginAttemptAt < loginRetryIntervalMs) {
          await delay(pollIntervalMs)
          continue
        }

        lastLoginAttemptAt = now
        const { error } = await withTimeout(client.auth.signInWithPassword(staffCredentials), 'Login de Auth')
        if (error) {
          throw new Error('Auth todavía no acepta el usuario demo.')
        }

        authenticated = true
      }

      await withTimeout(assertAuthenticatedPostgrestReady(client), 'PostgREST autenticado')
      const metrics = await withTimeout(assertCleanDemoState(client), 'Baseline de PostgREST')
      await withTimeout(assertAnonymousPostgrestReady(url, publishableKey), 'PostgREST anónimo')

      completedStableChecks += 1
      if (completedStableChecks < requiredStableChecks) {
        await delay(pollIntervalMs)
        continue
      }

      console.log('Supabase local ready:')
      console.log('- Auth: ready')
      console.log('- PostgREST authenticated: ready')
      console.log('- PostgREST anon: ready')
      console.log(`- Demo state: ${metrics.join(' / ')}`)
      return
    } catch (error) {
      if (error instanceof DirtyDemoStateError) {
        throw error
      }

      completedStableChecks = 0
      lastError = error instanceof Error ? error.message : 'Error de readiness desconocido.'
      await delay(pollIntervalMs)
    }
  }

  throw new Error(`Supabase local no estuvo listo en ${readinessTimeoutMs / 1000} s. Último estado: ${lastError}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'No fue posible comprobar el readiness local.')
    process.exit(1)
  })
