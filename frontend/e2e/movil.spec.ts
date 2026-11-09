import { expect, test, type Page } from '@playwright/test'

const PAGES = ['/', '/laboratorio', '/puentes', '/rearmonizar', '/escalas', '/negativa', '/analizador', '/ritmo', '/oido',
  '/lectura', '/pistas', '/bach', '/biblioteca', '/asistente']

/** Elementos que se salen por la derecha sin que ningún contenedor los recorte con scroll. */
async function overflowing(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const out: string[] = []
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= vw + 1) continue
      let a = el.parentElement
      let clipped = false
      while (a && a.tagName !== 'MAIN') {
        if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(a).overflowX)) { clipped = true; break }
        a = a.parentElement
      }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (+${Math.round(r.right - vw)}px)`)
    }
    return [...new Set(out)].slice(0, 5)
  })
}

test('en el móvil nada se sale de la pantalla y el menú funciona', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    expect(await overflowing(page), `desborde en ${path}`).toEqual([])
  }
  await page.getByRole('button', { name: 'Menú' }).click()
  await page.getByRole('link', { name: 'Oído' }).click()
  await expect(page).toHaveURL(/\/oido$/)
})

test('en una tablet tampoco hay desbordes', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' })
    expect(await overflowing(page), `desborde en ${path}`).toEqual([])
  }
})

test('en el móvil y en modo guitarra tampoco se sale nada (mástil y tutor incluidos)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('armonia:instrumento', 'guitarra'))
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    expect(await overflowing(page), `desborde en ${path}`).toEqual([])
  }
})
