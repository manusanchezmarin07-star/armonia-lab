import { expect, test, type Page } from '@playwright/test'

// Teclado MIDI simulado: se inyecta Web MIDI con una entrada "Alesis Q49".
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const input = { name: 'Alesis Q49', onmidimessage: null as null | ((e: { data: Uint8Array }) => void) }
    ;(window as unknown as { __midi: typeof input }).__midi = input
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => ({ inputs: new Map([['q49', input]]), onstatechange: null }) })
  })
})

const send = (page: Page, ...msgs: number[][]) => page.evaluate((m) => {
  const w = window as unknown as { __midi: { onmidimessage: (e: { data: Uint8Array }) => void } }
  m.forEach((b) => w.__midi.onmidimessage({ data: new Uint8Array(b) }))
}, msgs)

test('transporte, aprender un botón, fader de volumen y monitor', async ({ page }) => {
  await page.goto('/laboratorio', { waitUntil: 'networkidle' })
  await expect(page.getByText('MIDI: Alesis Q49')).toBeVisible()
  await page.getByRole('button', { name: /MIDI y controles/ }).click()
  const panel = page.getByRole('dialog', { name: 'Teclado MIDI y controles' })

  // Tocar con las teclas de Do y que suene en Sol.
  await panel.locator('select').selectOption('7')
  await expect(panel.getByText('Tocas Do → suena Sol')).toBeVisible()

  // Aprender: el CC 20 pasa a ser «Transponer +½ tono».
  await panel.locator('.map-row', { hasText: 'Transponer +½ tono' }).getByRole('button', { name: 'Aprender' }).click()
  await send(page, [0xb0, 20, 127])
  await expect(panel.locator('.map-row', { hasText: 'Transponer +½ tono' }).getByText('CC 20')).toBeVisible()
  await send(page, [0xb0, 20, 0], [0xb0, 20, 127], [0xb0, 20, 0])
  await expect(panel.locator('.transpose-n')).toHaveText('-4')

  // Fader de volumen (CC 7 por defecto) y monitor.
  await send(page, [0xb0, 7, 64])
  await expect(panel.getByText('Volumen 50 %')).toBeVisible()
  await expect(panel.getByText('CC 7 (volumen) = 64')).toBeVisible()
  await panel.getByRole('button', { name: 'Quitar', exact: true }).first().click()
  await expect(panel.locator('.transpose-n')).toHaveText('0')
  await page.keyboard.press('Escape')

  // Con transporte −5, tocar Do-Mi-Sol en el teclado suena (y se analiza) como Sol mayor.
  await page.getByRole('button', { name: /MIDI y controles/ }).click()
  await page.getByRole('dialog').locator('select').selectOption('7')
  await page.keyboard.press('Escape')
  await send(page, [0x90, 60, 90], [0x90, 64, 90], [0x90, 67, 90])
  await expect(page.locator('.chord-big').first()).toHaveText('G')
  await expect(page.locator('.sidebar .pill.accent', { hasText: '-5' })).toBeVisible()
})
