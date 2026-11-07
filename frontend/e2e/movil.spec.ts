import { expect, test } from '@playwright/test'

const PAGES = ['/', '/laboratorio', '/puentes', '/rearmonizar', '/escalas', '/negativa', '/analizador', '/ritmo', '/oido',
  '/lectura', '/biblioteca', '/asistente']

test('en el móvil ninguna pantalla se desborda en horizontal y el menú funciona', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `desborde en ${path}`).toBeLessThanOrEqual(1)
  }
  await page.getByRole('button', { name: 'Menú' }).click()
  await page.getByRole('link', { name: 'Oído' }).click()
  await expect(page).toHaveURL(/\/oido$/)
})
