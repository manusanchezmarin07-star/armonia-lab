import { expect, test, type Page } from '@playwright/test'

const PAGES = ['/', '/laboratorio', '/puentes', '/rearmonizar', '/escalas', '/negativa', '/analizador', '/ritmo', '/oido',
  '/lectura', '/pistas', '/bach', '/biblioteca', '/asistente', '/flamenco']

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

test('tour guiado: recorre la app y se puede cerrar', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('button', { name: '▶ Tour guiado' }).click()
  await expect(page.locator('.tour-title')).toHaveText('Bienvenido a Armonía Lab')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Siguiente/ }).click()
  await expect(page).toHaveURL(/\/laboratorio$/)
  await expect(page.locator('.tour-spot')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.tour-card')).toHaveCount(0)
  // Tour de una sola pantalla con el botón «?».
  await page.getByRole('button', { name: 'Tour de esta pantalla' }).click()
  await expect(page.locator('.tour-title')).toHaveText('Laboratorio: toca')
})

test('grabadora: grabar dos acordes y sacar la progresión', async ({ page }) => {
  await open(page, '/laboratorio')
  await page.getByRole('button', { name: '● Grabar' }).click()
  await playChord(page, ['a', 'd', 'g']) // C
  await page.waitForTimeout(250)
  await playChord(page, ['f', 'h', 'k']) // F
  await page.getByRole('button', { name: '■ Parar' }).click()
  await page.getByRole('button', { name: 'Sacar acordes' }).click()
  await expect(page.getByText('C  F', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir en el Analizador →' }).click()
  await expect(page.locator('textarea')).toHaveValue('C F')
})

test('teclado del ordenador: cambiar de octava o de ventana no deja notas colgadas', async ({ page }) => {
  await open(page, '/laboratorio')
  const notes = page.locator('.card').first().locator('.small.muted').last()
  await page.keyboard.down('a') // Do4
  await page.keyboard.press('x') // octava arriba con la tecla aún pulsada
  await page.keyboard.up('a')
  await page.keyboard.down('d') // Mi5: si Do4 se hubiera quedado colgado, saldría «C4 · E5»
  await expect(notes).toHaveText('E5')
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))) // cambiar de ventana con Mi5 pulsado
  await page.keyboard.down('g')
  await expect(notes).toHaveText('G5')
  await page.keyboard.up('g')
})

test('interruptor piano/guitarra: cambia el instrumento en toda la app y se recuerda', async ({ page }) => {
  await open(page, '/')
  await page.locator('.instrument-switch.big').getByRole('radio', { name: /Guitarra/ }).click()
  await page.getByRole('link', { name: 'Laboratorio', exact: true }).first().click()
  await expect(page.locator('svg.fretboard')).toBeVisible()
  await playChord(page, ['a', 'd', 'g'])
  await expect(page.locator('.chord-big').first()).toHaveText('C')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('svg.fretboard')).toBeVisible() // se recuerda
  await page.locator('.sidebar .instrument-switch').getByRole('radio', { name: /Piano/ }).click()
  await expect(page.locator('svg.piano')).toBeVisible()
})

/** Arranca la app directamente en modo guitarra (como si el usuario ya lo hubiera elegido). */
async function asGuitar(page: Page) {
  await page.addInitScript(() => localStorage.setItem('armonia:instrumento', 'guitarra'))
}

test('tutor de guitarra: posiciones, montar el acorde dedo a dedo y patrón p-i-m-a', async ({ page }) => {
  const errors = watchErrors(page)
  await asGuitar(page)
  await open(page, '/laboratorio')
  await playChord(page, ['a', 'd', 'g'])
  await page.getByRole('button', { name: '🎸 Cómo se toca' }).click()
  const dlg = page.getByRole('dialog', { name: 'Cómo tocar C en guitarra' })
  // La posición de manual sale primera: x32010.
  await expect(dlg.getByRole('img', { name: 'C x32010' })).toBeVisible()
  await expect(dlg.getByText('1. Dedo 3 (anular): 5ª cuerda, traste 3')).toBeVisible()
  // Modo espera: el Do (cualquier octava) cumple el paso del dedo 3.
  await playChord(page, ['a'])
  await expect(dlg.getByText('✓ Dedo 3')).toBeVisible()
  await dlg.getByRole('button', { name: '2 · Rasgueo y arpegio' }).click()
  await dlg.getByLabel('Patrón').selectOption('pima')
  await expect(dlg.locator('.arp-cell')).toHaveText(['p', 'i', 'm', 'a'])
  // Con cejilla en el 5 el Do se toca con forma de Sol.
  await dlg.getByLabel('Cejilla').selectOption('5')
  await expect(dlg.getByText(/tocas la forma de G/)).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('lectura en guitarra: clave de Sol octavada y se responde una octava más grave', async ({ page }) => {
  await asGuitar(page)
  await open(page, '/lectura')
  await expect(page.getByText('1 · Cuerdas 1ª a 3ª (primera posición)')).toBeVisible()
  await page.getByLabel('Exigir la octava exacta').check()
  await page.keyboard.press('Space')
  // Pulsar cualquier casilla del mástil cuenta como respuesta (acierto o fallo).
  await page.locator('svg.fretboard rect[fill="transparent"]').first().dispatchEvent('pointerdown')
  await expect(page.locator('.feedback')).toBeVisible()
})

test('rearmonizar en guitarra: cada sustituto lleva su diagrama', async ({ page }) => {
  await asGuitar(page)
  await open(page, '/rearmonizar')
  await page.getByRole('button', { name: 'Sustituir un acorde' }).click()
  await page.getByRole('button', { name: 'Buscar sustitutos' }).click()
  await expect(page.locator('svg.chord-diagram').first()).toBeVisible()
})

test('guitarra flamenca: compás con golpes, tablatura y bulería contando desde el 12', async ({ page }) => {
  const errors = watchErrors(page)
  await asGuitar(page)
  await open(page, '/flamenco')
  const compas = page.getByRole('list', { name: 'Compás' })
  await expect(compas.locator('.compas-beat.acc .compas-n')).toHaveText(['3', '6', '8', '10', '12'])
  await expect(page.getByRole('img', { name: 'Tablatura' })).toBeVisible()
  await page.getByLabel('Palo').selectOption('buleria')
  await expect(compas.locator('.compas-n').first()).toHaveText('12')
  await page.getByLabel('Tono').selectOption('medio')
  await expect(page.getByRole('button', { name: 'Escuchar Dm – C – Bb – A' })).toBeVisible()
  await page.mouse.click(10, 10)
  await page.getByRole('button', { name: 'Tocar el compás' }).click()
  await expect(compas.locator('.compas-beat.on')).toHaveCount(1, { timeout: 5000 })
  await page.getByRole('button', { name: 'Parar' }).first().click()
  expect(errors).toEqual([])
})

test('laboratorio en guitarra: se monta un acorde con el ratón y lo reconoce', async ({ page }) => {
  const errors = watchErrors(page)
  await asGuitar(page)
  await open(page, '/laboratorio')
  // Casillas del mástil: por cuerda (1ª arriba), la cuerda al aire y luego cada traste visible.
  const perString = await page.locator('svg.fretboard rect[fill="transparent"]').count() / 6
  const cell = (string: number, fret: number) => page.locator('svg.fretboard rect[fill="transparent"]').nth((string - 1) * perString + fret)
  // Do mayor de manual: x32010
  for (const [s, f] of [[5, 3], [4, 2], [3, 0], [2, 1], [1, 0]]) await cell(s, f).dispatchEvent('pointerdown')
  await expect(page.locator('.chord-big').first()).toHaveText('C')
  await expect(page.locator('[data-tour="lab-chord"] svg.chord-diagram')).toBeVisible() // «así se toca», junto al nombre
  // Otra casilla en la misma cuerda la sustituye (una nota por cuerda): 2ª al aire = Si → Cmaj7.
  await cell(2, 0).dispatchEvent('pointerdown')
  await expect(page.locator('.chord-big').first()).toHaveText('Cmaj7')
  await page.getByRole('button', { name: 'Soltar todo' }).click()
  expect(errors).toEqual([])
})

test('en guitarra los acordes se dibujan con su posición de guitarra y caben en columnas estrechas', async ({ page }) => {
  await asGuitar(page)
  await open(page, '/analizador')
  await page.getByRole('button', { name: 'Analizar' }).click()
  const fb = page.locator('svg.fretboard').first()
  await expect(fb.locator('text', { hasText: '×' }).first()).toBeVisible() // cuerda apagada: es una posición, no notas sueltas
  // El mástil no se sale de su tarjeta (antes tenía un ancho mínimo y se cortaba).
  const fits = await fb.evaluate((el) => el.getBoundingClientRect().right <= el.closest('.card')!.getBoundingClientRect().right + 1)
  expect(fits).toBe(true)
})
