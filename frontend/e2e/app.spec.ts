import { expect, test, type Page } from '@playwright/test'

const PAGES = ['/', '/laboratorio', '/puentes', '/rearmonizar', '/escalas', '/negativa', '/analizador', '/ritmo', '/oido',
  '/lectura', '/pistas', '/bach', '/biblioteca', '/asistente']

/** Falla el test si la página escribe errores en consola o lanza excepciones. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('salamander')) errors.push(m.text()) })
  return errors
}

/** Navega y espera a que la app haya montado sus escuchadores de teclado y MIDI. */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' })
  await expect(page.locator('h1').first()).toBeVisible()
}

async function playChord(page: Page, keys: string[]) {
  for (const k of keys) await page.keyboard.down(k)
  await page.waitForTimeout(150)
  for (const k of keys) await page.keyboard.up(k)
}

test('todas las pantallas cargan sin errores', async ({ page }) => {
  const errors = watchErrors(page)
  for (const path of PAGES) {
    await open(page, path)
  }
  expect(errors).toEqual([])
})

test('laboratorio reconoce un acorde tocado con el teclado del ordenador', async ({ page }) => {
  await open(page, '/laboratorio')
  await playChord(page, ['a', 'd', 'g', 'u']) // Do Mi Sol Sib
  await expect(page.locator('.chord-big').first()).toHaveText('C7')
  await expect(page.getByText('V7/IV')).toBeVisible()
  // Teoría acorde-escala: sobre C7 encaja el mixolidio, y el enlace abre esa escala.
  await page.getByRole('link', { name: 'Mixolidio', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'C Mixolidio' })).toBeVisible()
})

test('analizador: grados, modulación y transporte', async ({ page }) => {
  await open(page, '/analizador')
  await page.locator('textarea').fill('Dm7 G7 Cmaj7 Cm7 F7 Bbmaj7')
  await page.getByRole('button', { name: 'Analizar' }).click()
  await expect(page.getByText('modula a Bb mayor')).toBeVisible()
  await page.locator('select[title="Transportar"]').selectOption('Eb')
  await expect(page.locator('textarea')).toHaveValue('Fm7 Bb7 Ebmaj7 Ebm7 Ab7 Dbmaj7')
})

test('armonía negativa de una ii–V–I', async ({ page }) => {
  await open(page, '/negativa')
  await page.getByRole('button', { name: 'ii – V – I' }).click()
  for (const sym of ['Gm7', 'Dm7b5', 'Abmaj7']) await expect(page.getByText(sym, { exact: true }).first()).toBeVisible()
})

test('rearmonizar propone el sustituto tritonal', async ({ page }) => {
  await open(page, '/rearmonizar')
  await page.getByRole('button', { name: 'Sustituir un acorde' }).click()
  await page.getByRole('button', { name: 'Buscar sustitutos' }).click()
  await expect(page.getByText('Sustituto tritonal').first()).toBeVisible()
})

test('oído: se puede responder tocando en el teclado', async ({ page }) => {
  await open(page, '/oido')
  await page.getByText('Tipos de acorde').first().click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await playChord(page, ['a', 'd', 'g'])
  await expect(page.locator('.feedback')).toBeVisible()
})

test('lectura: aparece una nota y se responde con el teclado', async ({ page }) => {
  await open(page, '/lectura')
  await page.keyboard.press('Space')
  await playChord(page, ['a'])
  await expect(page.locator('.feedback')).toBeVisible()
})

test('biblioteca: crear y borrar una transcripción', async ({ page }) => {
  await open(page, '/biblioteca')
  await page.getByRole('button', { name: 'Nueva transcripción' }).click()
  await page.getByPlaceholder('Canción · sección').fill('Prueba e2e')
  await page.getByPlaceholder('Ebmaj7 Dm7 G7(b9) | Cm9 ...').fill('Cmaj7 A7 Dm7 G7')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Prueba e2e')).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.locator('.card', { hasText: 'Prueba e2e' }).getByTitle('Borrar').click()
  await expect(page.getByText('Prueba e2e')).toHaveCount(0)
})

test('el asistente rechaza preguntas que no son de música', async ({ page }) => {
  await open(page, '/asistente')
  await page.getByPlaceholder(/por qué Fm6/).fill('¿Me das una receta de arroz?')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Solo puedo ayudarte con música').first()).toBeVisible()
})

test('buscador rápido con Ctrl+K', async ({ page }) => {
  await open(page, '/')
  await page.keyboard.press('Control+k')
  await expect(page.getByPlaceholder(/Ir a/)).toBeFocused()
  await page.keyboard.type('bach')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/bach$/)
})

test('tutor de acordes: digitación, modo espera y grabación', async ({ page }) => {
  await open(page, '/laboratorio')
  await playChord(page, ['a', 'd', 'g']) // Do mayor
  await page.getByRole('button', { name: '🎹 Cómo se toca' }).click()
  const dlg = page.getByRole('dialog', { name: 'Cómo tocar C' })
  await expect(dlg.getByText('pulgar').first()).toBeVisible()
  // Modo espera: paso 2 (mano derecha = Do4-Mi4-Sol4) tocado con el teclado del ordenador.
  await dlg.getByText('2. Mano derecha').click()
  for (const k of ['a', 'd', 'g']) await page.keyboard.down(k)
  await page.waitForTimeout(200)
  for (const k of ['a', 'd', 'g']) await page.keyboard.up(k)
  await expect(dlg.getByText('✓ Mano derecha')).toBeVisible()
  // Grabar la derecha en bloque y recibir la evaluación.
  await dlg.getByRole('button', { name: '3 · Practicar y grabar' }).click()
  await dlg.locator('select').selectOption('bloque')
  await dlg.getByRole('button', { name: '● Grabar' }).click()
  await playChord(page, ['a', 'd', 'g'])
  await dlg.getByRole('button', { name: '■ Terminar toma' }).click()
  await expect(dlg.getByText(/Faltaron: Do3, Sol3/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dlg).toBeHidden()
})
