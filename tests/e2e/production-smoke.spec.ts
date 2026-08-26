import { expect, test } from '@playwright/test'

const deploymentUrl = process.env.DEPLOYMENT_URL
const deploymentStaffEmail = process.env.DEPLOYMENT_STAFF_EMAIL
const deploymentStaffPassword = process.env.DEPLOYMENT_STAFF_PASSWORD

function requireProductionSmokeEnvironment() {
  if (!deploymentUrl || !deploymentStaffEmail || !deploymentStaffPassword) {
    throw new Error('DEPLOYMENT_URL, DEPLOYMENT_STAFF_EMAIL y DEPLOYMENT_STAFF_PASSWORD son obligatorios para el smoke hosted.')
  }

  let url: URL

  try {
    url = new URL(deploymentUrl)
  } catch {
    throw new Error('DEPLOYMENT_URL debe ser una URL HTTPS válida.')
  }

  if (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    throw new Error('El smoke hosted exige una DEPLOYMENT_URL HTTPS no local.')
  }

  return {
    staffEmail: deploymentStaffEmail,
    staffPassword: deploymentStaffPassword,
    url: url.toString().replace(/\/$/, ''),
  }
}

test('validates the hosted deployment without changing data', async ({ page }) => {
  const environment = requireProductionSmokeEnvironment()
  const pageErrors: string[] = []
  const serverErrors: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto(`${environment.url}/login`)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  await page.goto(`${environment.url}/scan`)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()

  await page.goto(`${environment.url}/public/not-a-chip`)
  await expect(page.getByRole('heading', { name: 'Microchip no encontrado.' })).toBeVisible()

  await page.goto(`${environment.url}/login`)
  await page.getByLabel('Email').fill(environment.staffEmail)
  await page.getByLabel('Contraseña').fill(environment.staffPassword)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/$/)

  for (const label of [
    'Animales registrados',
    'Microchips disponibles',
    'Microchips implantados',
    'Animales perdidos',
    'Reportes pendientes',
  ]) {
    const card = page.getByRole('heading', { exact: true, name: label }).locator('..')
    await expect(card.locator('p').last()).toHaveText(/^\d+$/)
  }

  await page.goto(`${environment.url}/microchips`)
  await expect(page.getByRole('heading', { name: 'Microchips' })).toBeVisible()
  await expect(page.getByText('No hay microchips registrados.').or(page.getByLabel('Listado de microchips'))).toBeVisible()

  await page.goto(`${environment.url}/scan`)
  await expect(page.getByLabel('Código del microchip')).toBeVisible()

  await page.goto(`${environment.url}/recovery-reports`)
  await expect(page.getByRole('heading', { name: 'Reportes de recuperación' })).toBeVisible()
  await expect(page.getByText('No hay reportes de recuperación.').or(page.getByLabel('Listado de reportes de recuperación'))).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(pageErrors).toEqual([])
  expect(serverErrors).toEqual([])
})
