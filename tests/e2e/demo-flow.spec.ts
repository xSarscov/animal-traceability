import { expect, test, type Page } from '@playwright/test'

import { getLocalSupabaseEnvironment } from '../../scripts/local-supabase.mjs'

const demoChipCode = '990000015300168'

// This guard also applies when somebody bypasses npm run test:e2e and invokes
// Playwright directly. The test performs destructive writes to the demo chip.
getLocalSupabaseEnvironment()

async function expectMetric(page: Page, label: string, value: number) {
  const card = page.getByRole('heading', { exact: true, name: label }).locator('..')
  await expect(card).toContainText(String(value))
}

async function expectDashboard(page: Page, metrics: [number, number, number, number, number]) {
  await expectMetric(page, 'Animales registrados', metrics[0])
  await expectMetric(page, 'Microchips disponibles', metrics[1])
  await expectMetric(page, 'Microchips implantados', metrics[2])
  await expectMetric(page, 'Animales perdidos', metrics[3])
  await expectMetric(page, 'Reportes pendientes', metrics[4])
}

test('completes the local MVP demo flow end to end', async ({ browser, page }) => {
  const pageErrors: string[] = []
  const applicationHttpErrors: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    const url = response.url()
    const isSupabaseRequest = /\/(auth|rest|rpc)\/v1\//.test(url)

    if (isSupabaseRequest && response.status() >= 400) {
      applicationHttpErrors.push(`${response.status()} ${url}`)
    }
  })

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  await page.getByLabel('Email').fill('staff@animal-traceability.test')
  await page.getByLabel('Contraseña').fill('DemoStaff123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Animal Traceability' })).toBeVisible()
  await expectDashboard(page, [0, 1, 0, 0, 0])

  await page.getByRole('link', { name: 'Escanear microchip' }).click()
  await expect(page).toHaveURL(/\/scan$/)
  await page.getByLabel('Código del microchip').fill(demoChipCode)
  await page.getByLabel('Código del microchip').press('Enter')
  await expect(page.getByRole('heading', { name: 'Microchip disponible' })).toBeVisible()
  await page.getByRole('link', { name: 'Registrar animal' }).click()
  await expect(page).toHaveURL(/\/animals\/new\?chip=990000015300168$/)

  await page.getByLabel('Nombre *').fill('Luna')
  await page.getByLabel('Especie *').fill('Perro')
  await page.getByLabel('Sexo *').selectOption('female')
  await page.getByLabel('Nombre completo *').fill('PRIVATE OWNER E2E')
  await page.getByLabel('Teléfono').fill('PRIVATE-PHONE-E2E')
  await page.getByLabel('Email').fill('private-owner-e2e@example.test')
  await page.getByLabel('Dirección').fill('PRIVATE ADDRESS E2E')
  await page.getByRole('button', { name: 'Registrar animal' }).click()

  await expect(page.getByRole('heading', { name: 'Animal registrado' })).toBeVisible()
  await expect(page.getByText('Luna quedó asociado al microchip 990000015300168.')).toBeVisible()
  await expect(page.getByText('El microchip quedó implantado.')).toBeVisible()
  await page.getByRole('link', { name: 'Ver perfil' }).click()
  await expect(page).toHaveURL(/\/animals\/[0-9a-f-]{36}$/)
  const animalPath = new URL(page.url()).pathname

  await expect(page.getByRole('heading', { name: 'Luna' })).toBeVisible()
  await expect(page.getByText('Perro · Hembra')).toBeVisible()
  await expect(page.getByText('Activo', { exact: true })).toBeVisible()
  await expect(page.getByText(demoChipCode, { exact: true })).toBeVisible()
  await expect(page.getByText('PRIVATE OWNER E2E')).toBeVisible()
  await expect(page.getByText('PRIVATE-PHONE-E2E')).toBeVisible()
  await expect(page.getByText('private-owner-e2e@example.test')).toBeVisible()
  await expect(page.getByText('PRIVATE ADDRESS E2E')).toBeVisible()
  await expect(page.getByText('Animal registrado')).toBeVisible()
  await expect(page.getByText('Microchip implantado')).toBeVisible()

  await page.getByLabel('Vacuna *').fill('Rabia')
  await page.getByLabel('Lote').fill('E2E-RAB-001')
  await page.getByRole('button', { name: 'Registrar vacunación' }).click()
  await expect(page.getByText('Vacunación registrada.')).toBeVisible()
  await expect(page.getByText('Vacunación: Rabia')).toBeVisible()

  await page.getByLabel('Título *').fill('Revisión E2E')
  await page.getByLabel('Descripción').fill('Nota creada durante validación M12.')
  await page.getByRole('button', { name: 'Agregar nota' }).click()
  await expect(page.getByText('Nota agregada.')).toBeVisible()
  await expect(page.getByText('Revisión E2E')).toBeVisible()

  await page.getByRole('button', { name: 'Marcar como perdido' }).click()
  await expect(page.getByText('Animal marcado como perdido.')).toBeVisible()
  await expect(page.getByText('Perdido', { exact: true })).toBeVisible()
  await expect(page.getByText('Animal marcado como perdido', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Escanear' }).click()
  await page.getByLabel('Código del microchip').fill(demoChipCode)
  await page.getByLabel('Código del microchip').press('Enter')
  await expect(page).toHaveURL(animalPath)
  await expect(page.getByRole('heading', { name: 'Luna' })).toBeVisible()
  await expect(page.getByText('Perdido', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Inicio' }).click()
  await expectDashboard(page, [1, 0, 1, 1, 0])

  const publicContext = await browser.newContext({ viewport: { height: 844, width: 390 } })

  try {
    const publicPage = await publicContext.newPage()
    await publicPage.goto(`/public/${demoChipCode}`)
    const authKeys = await publicPage.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('auth-token')))

    expect(authKeys).toEqual([])
    await expect(publicPage.getByRole('heading', { name: 'Luna' })).toBeVisible()
    await expect(publicPage.getByText('Perro · Hembra')).toBeVisible()
    await expect(publicPage.getByLabel('Información del animal').getByText('Perdido', { exact: true })).toBeVisible()
    await expect(publicPage.getByText('Animal reportado como perdido')).toBeVisible()
    await expect(publicPage.getByRole('heading', { name: 'Encontré este animal' })).toBeVisible()
    await expect(publicPage.getByText('PRIVATE OWNER E2E')).not.toBeVisible()
    await expect(publicPage.getByText('PRIVATE-PHONE-E2E')).not.toBeVisible()
    await expect(publicPage.getByText('private-owner-e2e@example.test')).not.toBeVisible()
    await expect(publicPage.getByText('PRIVATE ADDRESS E2E')).not.toBeVisible()
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    await publicPage.getByLabel('Nombre *').fill('Persona E2E')
    await publicPage.getByLabel('Contacto *').fill('contacto-e2e@example.test')
    await publicPage.getByLabel('Mensaje').fill('Encontré a Luna durante el flujo E2E de M12.')
    await publicPage.getByRole('button', { name: 'Enviar reporte' }).click()
    await expect(publicPage.getByRole('heading', { name: 'Reporte enviado.' })).toBeVisible()
  } finally {
    await publicContext.close()
  }

  // El dashboard es deliberadamente read-only y no usa realtime: navegar a una
  // ruta distinta fuerza una lectura nueva tras la escritura anónima externa.
  await page.getByRole('link', { name: 'Reportes' }).click()
  await expect(page.getByRole('heading', { name: 'Reportes de recuperación' })).toBeVisible()
  await page.getByRole('link', { name: 'Inicio' }).click()
  await expectDashboard(page, [1, 0, 1, 1, 1])

  await page.getByRole('link', { name: 'Reportes' }).click()
  await expect(page.getByRole('heading', { name: 'Reportes de recuperación' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Luna' })).toBeVisible()
  await expect(page.getByText(demoChipCode, { exact: true })).toBeVisible()
  await expect(page.getByText('Pendiente', { exact: true })).toBeVisible()
  await expect(page.getByText('Persona E2E')).toBeVisible()
  await expect(page.getByText('contacto-e2e@example.test')).toBeVisible()
  await expect(page.getByText('Encontré a Luna durante el flujo E2E de M12.')).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como revisado' }).click()
  await expect(page.getByText('Reporte marcado como revisado.')).toBeVisible()
  await expect(page.getByText('Revisado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar reporte' })).toBeVisible()

  await page.getByRole('link', { name: 'Inicio' }).click()
  await expectDashboard(page, [1, 0, 1, 1, 0])

  await page.getByRole('link', { name: 'Reportes' }).click()
  await page.getByRole('link', { name: 'Ver animal' }).click()
  await expect(page).toHaveURL(animalPath)
  await expect(page.getByText('Perdido', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como encontrado' }).click()
  await expect(page.getByText('Animal marcado como encontrado.')).toBeVisible()
  await expect(page.getByText('Activo', { exact: true })).toBeVisible()
  await expect(page.getByText('Animal marcado como encontrado', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Reportes' }).click()
  await expect(page.getByText('Revisado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar reporte' }).click()
  await expect(page.getByText('Reporte cerrado.')).toBeVisible()
  await expect(page.getByText('Cerrado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar reporte' })).not.toBeVisible()

  await page.getByRole('link', { name: 'Inicio' }).click()
  await expectDashboard(page, [1, 0, 1, 0, 0])

  const publicAfterFound = await browser.newContext()

  try {
    const publicPage = await publicAfterFound.newPage()
    await publicPage.goto(`/public/${demoChipCode}`)
    await expect(publicPage.getByLabel('Información del animal').getByText('Activo', { exact: true })).toBeVisible()
    await expect(publicPage.getByRole('heading', { name: 'Encontré este animal' })).not.toBeVisible()
  } finally {
    await publicAfterFound.close()
  }

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(applicationHttpErrors).toEqual([])
})
