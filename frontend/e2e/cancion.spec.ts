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

test('modo canción en guitarra: pista de acordes, diagramas y modo espera', async ({ page, request }) => {
  const caps = await request.get('/api/stems/capabilities')
  test.skip(!caps.ok(), 'El módulo de pistas no está instalado en este entorno')
  const title = `Prueba guitarra ${Date.now()}`
  const up = await request.post('/api/stems', {
    multipart: { file: { name: `${title}.wav`, mimeType: 'audio/wav', buffer: readFileSync(new URL('./fixtures/progresion.wav', import.meta.url)) }, separate: 'false' },
  })
  const job = await up.json()
  try {
    await expect.poll(async () => (await (await request.get(`/api/stems/${job.id}`)).json()).status, { timeout: 30_000 }).toBe('listo')
    await page.addInitScript(() => localStorage.setItem('armonia:instrumento', 'guitarra'))
    await page.goto('/pistas', { waitUntil: 'networkidle' })
    await page.locator('.list-item', { hasText: title }).click()
    await page.getByRole('button', { name: /3 · Tutorial de guitarra/ }).click()
    const tut = page.locator('.song-tutorial')
    await expect(tut.locator('.lane-chip').first()).toBeVisible()
    await tut.getByLabel('Cejilla').selectOption('0')
    await expect(tut.getByRole('img', { name: /^C x32010/ }).first()).toBeVisible()
    await tut.getByLabel('Modo espera').check()
    await page.mouse.click(10, 10)
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

// Reproductor multipista. En CI no hay Demucs, así que se fabrica en disco una canción
// «ya separada» (como las de versiones anteriores, sin multipista): el servidor debe
// empaquetar sus pistas al abrirla y el navegador reproducirlas con un solo reloj.
test('pistas separadas: se reproducen juntas, con medidores, solo y salto sin errores', async ({ page, request }) => {
  const caps = await request.get('/api/stems/capabilities')
  test.skip(!caps.ok(), 'El módulo de pistas no está instalado en este entorno')
  const { mkdirSync, copyFileSync, writeFileSync, rmSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const wav = fileURLToPath(new URL('./fixtures/progresion.wav', import.meta.url))
  // Análisis real de la canción (sin separar) para reutilizar sus acordes.
  const up = await request.post('/api/stems', { multipart: { file: { name: 'base.wav', mimeType: 'audio/wav', buffer: readFileSync(wav) }, separate: 'false' } })
  const base = await up.json()
  await expect.poll(async () => (await (await request.get(`/api/stems/${base.id}`)).json()).status, { timeout: 30_000 }).toBe('listo')
  const analysis = (await (await request.get(`/api/stems/${base.id}`)).json()).analysis
  const id = `e2emulti${Date.now()}`
  const dir = fileURLToPath(new URL(`../../.e2e-data/stems/${id}/`, import.meta.url))
  mkdirSync(dir + 'sep', { recursive: true })
  for (const f of ['original.wav', 'sep/piano.wav', 'sep/bass.wav']) copyFileSync(wav, dir + f)
  writeFileSync(dir + 'meta.json', JSON.stringify({
    id, title: `Multipista ${id}`, status: 'listo', progress: 1, message: '', separated: true, device: 'CPU', analysis,
    stems: [{ id: 'bass', name: 'Bajo', file: 'sep/bass.wav', active: true }, { id: 'piano', name: 'Piano', file: 'sep/piano.wav', active: true },
      { id: 'mezcla', name: 'Mezcla original', file: 'original.wav', active: true }],
  }))
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  try {
    await page.goto('/pistas', { waitUntil: 'networkidle' })
    await page.locator('.list-item', { hasText: `Multipista ${id}` }).click()
    const play = page.getByRole('button', { name: 'Reproducir' }).first()
    await expect(play).toBeEnabled({ timeout: 20_000 }) // incluye crear el multipista la primera vez
    await expect(page.locator('.mixer-row')).toHaveCount(2) // bajo y piano; la mezcla ya no es una pista aparte
    await play.click()
    // Las dos pistas suenan: sus medidores se mueven.
    await expect.poll(async () => page.locator('.mixer-row .meter i').evaluateAll((els) => els.map((e) => parseInt((e as HTMLElement).style.width) || 0).filter((w) => w > 0).length), { timeout: 8000 }).toBe(2)
    await expect(page.locator('.nn-now b')).toHaveText('C')
    await page.getByRole('button', { name: 'Solo Bajo' }).click()
    await page.locator('input.range').first().fill('5')
    await expect.poll(async () => page.locator('.mono.small').first().textContent(), { timeout: 5000 }).toMatch(/0:0[5-9]/)
    await page.getByRole('button', { name: 'Pausa' }).first().click()
    expect(errors).toEqual([])
  } finally {
    await request.delete(`/api/stems/${base.id}`)
    rmSync(dir, { recursive: true, force: true })
  }
})

// Si el navegador no puede con el multipista (p. ej. no es Chrome ni Edge), la canción no puede
// quedarse muda: se pasa a las pistas sueltas y se explica el motivo.
test('si el multipista no carga, suenan las pistas sueltas y se avisa del motivo', async ({ page, request }) => {
  const caps = await request.get('/api/stems/capabilities')
  test.skip(!caps.ok(), 'El módulo de pistas no está instalado en este entorno')
  const { mkdirSync, copyFileSync, writeFileSync, rmSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const wav = fileURLToPath(new URL('./fixtures/progresion.wav', import.meta.url))
  const up = await request.post('/api/stems', { multipart: { file: { name: 'base2.wav', mimeType: 'audio/wav', buffer: readFileSync(wav) }, separate: 'false' } })
  const base = await up.json()
  await expect.poll(async () => (await (await request.get(`/api/stems/${base.id}`)).json()).status, { timeout: 30_000 }).toBe('listo')
  const analysis = (await (await request.get(`/api/stems/${base.id}`)).json()).analysis
  const id = `e2ereserva${Date.now()}`
  const dir = fileURLToPath(new URL(`../../.e2e-data/stems/${id}/`, import.meta.url))
  mkdirSync(dir + 'sep', { recursive: true })
  for (const f of ['original.wav', 'sep/piano.wav', 'sep/bass.wav']) copyFileSync(wav, dir + f)
  writeFileSync(dir + 'meta.json', JSON.stringify({
    id, title: `Reserva ${id}`, status: 'listo', progress: 1, message: '', separated: true, device: 'CPU', analysis,
    stems: [{ id: 'bass', name: 'Bajo', file: 'sep/bass.wav', active: true }, { id: 'piano', name: 'Piano', file: 'sep/piano.wav', active: true },
      { id: 'mezcla', name: 'Mezcla original', file: 'original.wav', active: true }],
  }))
  try {
    // El multipista se crea, pero el navegador recibe algo que no sabe decodificar.
    let broken = false
    await page.route('**/api/stems/*/multitrack', (route) => (broken ? route.fulfill({ status: 200, contentType: 'audio/ogg', body: 'esto no es audio' }) : route.continue()))
    await page.goto('/pistas', { waitUntil: 'networkidle' })
    await page.locator('.list-item', { hasText: `Reserva ${id}` }).click()
    await expect(page.getByRole('button', { name: 'Reproducir' }).first()).toBeEnabled({ timeout: 20_000 })
    broken = true
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.list-item', { hasText: `Reserva ${id}` }).click()
    await expect(page.getByText(/suenan como pistas sueltas/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Detalle técnico:/)).toBeVisible()
    const play = page.getByRole('button', { name: 'Reproducir' }).first()
    await expect(play).toBeEnabled({ timeout: 15_000 })
    await play.click()
    await expect.poll(async () => page.locator('.mono.small').first().textContent(), { timeout: 8000 }).toMatch(/0:0[1-9]/)
    await page.getByRole('button', { name: 'Solo Bajo' }).click()
    await page.getByRole('button', { name: 'Pausa' }).first().click()
  } finally {
    await request.delete(`/api/stems/${base.id}`)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('melodía: se detecta bajo demanda y se ve en el rollo con la nota actual', async ({ page, request }) => {
  const caps = await request.get('/api/stems/capabilities')
  test.skip(!caps.ok(), 'El módulo de pistas no está instalado en este entorno')
  const title = `Melodía e2e ${Date.now()}`
  const up = await request.post('/api/stems', {
    multipart: { file: { name: `${title}.wav`, mimeType: 'audio/wav', buffer: readFileSync(new URL('./fixtures/progresion.wav', import.meta.url)) }, separate: 'false' },
  })
  const job = await up.json()
  try {
    await expect.poll(async () => (await (await request.get(`/api/stems/${job.id}`)).json()).status, { timeout: 30_000 }).toBe('listo')
    await page.goto('/pistas', { waitUntil: 'networkidle' })
    await page.locator('.list-item', { hasText: title }).click()
    await page.getByRole('button', { name: /4 · Melodía/ }).click()
    await expect(page.getByLabel('Pista de la melodía')).toHaveValue('mezcla')
    await page.getByRole('button', { name: 'Detectar melodía' }).click()
    // Termina y enseña el resultado: el rollo con las notas o el aviso de que no hay melodía clara.
    await expect(page.getByRole('button', { name: 'Volver a detectar' })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.melody-roll').or(page.getByText(/No he encontrado una melodía clara/))).toBeVisible()
    const saved = await (await request.get(`/api/stems/${job.id}`)).json()
    expect(saved.melody_status).toBe('listo')
    expect(saved.melody.stem).toBe('mezcla')
  } finally {
    await request.delete(`/api/stems/${job.id}`)
  }
})
