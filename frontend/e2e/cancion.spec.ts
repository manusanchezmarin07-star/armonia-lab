import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Flujo completo del modo canción: subir audio → acordes → letra con acordes →
// validar → tutorial de piano con modo espera. Necesita librosa en el backend.
test('modo canción: letra con acordes y tutorial con modo espera', async ({ page, request }) => {
  const caps = await request.get('/api/stems/capabilities')
  test.skip(!caps.ok(), 'El módulo de pistas no está instalado en este entorno')
  const title = `Prueba e2e ${Date.now()}`
  const up = await request.post('/api/stems', {
    multipart: { file: { name: `${title}.wav`, mimeType: 'audio/wav', buffer: readFileSync(new URL('./fixtures/progresion.wav', import.meta.url)) }, separate: 'false' },
  })
  const job = await up.json()
  try {
  await expect.poll(async () => (await (await request.get(`/api/stems/${job.id}`)).json()).status, { timeout: 30_000 }).toBe('listo')
  await request.put(`/api/stems/${job.id}/lyrics`, { data: { text: 'primera línea de la canción\nsegunda línea que sigue' } })

  await page.goto('/pistas', { waitUntil: 'networkidle' })
  await page.locator('.list-item', { hasText: title }).click()
  await page.getByRole('button', { name: '2 · Letra y acordes' }).click()
  await expect(page.locator('.sheet-word').first()).toContainText('primera')
  await expect(page.locator('.sheet-chord').first()).toHaveText('C')
  await page.getByRole('button', { name: '✓ Está bien' }).click()
  await expect(page.getByText('✓ validada')).toBeVisible()

  await page.getByRole('button', { name: /3 · Tutorial de piano/ }).click()
  const tut = page.locator('.song-tutorial')
  await expect(tut.locator('svg.fall rect').first()).toBeVisible()
  await tut.getByLabel('Modo espera').check()
  await page.mouse.click(10, 10) // gesto para el audio
  await tut.getByRole('button', { name: 'Reproducir' }).click()
  await expect(tut.getByText('Toca C para seguir')).toBeVisible({ timeout: 10_000 })
  for (const k of ['a', 'd', 'g']) await page.keyboard.down(k)
  await page.waitForTimeout(150)
  for (const k of ['a', 'd', 'g']) await page.keyboard.up(k)
  await expect(tut.getByText('Toca C para seguir')).toBeHidden()
  } finally {
    await request.delete(`/api/stems/${job.id}`)
  }
})
