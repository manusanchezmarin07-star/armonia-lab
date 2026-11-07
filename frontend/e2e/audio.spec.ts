import { expect, test } from '@playwright/test'

// Reproduce el caso real: Chrome con la política de autoplay normal y un teclado
// MIDI (simulado) que toca una nota ANTES de cualquier clic en la página.
test.beforeEach(async ({ page }) => {
  // El Chromium de los tests no aplica la política de autoplay, así que se emula
  // igual que la hace Chrome: el AudioContext nace en pausa y resume() solo
  // funciona durante un gesto del usuario; fuera de él la promesa queda pendiente.
  await page.addInitScript(() => {
    const Native = window.AudioContext
    class Policed extends Native {
      private fake: AudioContextState = 'suspended'
      get state() { return this.fake }
      resume() {
        if (navigator.userActivation?.isActive) {
          this.fake = 'running'
          this.dispatchEvent(new Event('statechange'))
          return super.resume()
        }
        return new Promise<void>(() => {})
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: Policed, configurable: true })
  })
  await page.addInitScript(() => {
    const input = { name: 'Alesis Q49', onmidimessage: null as null | ((e: { data: Uint8Array }) => void) }
    ;(window as unknown as { __midi: typeof input }).__midi = input
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: async () => ({ inputs: new Map([['q49', input]]), onstatechange: null }),
    })
  })
})

test('una nota MIDI sin clic previo avisa de que el sonido está en pausa y un clic lo activa', async ({ page }) => {
  await page.goto('/laboratorio', { waitUntil: 'networkidle' })
  await expect(page.getByText('MIDI: Alesis Q49')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __midi: { onmidimessage: (e: { data: Uint8Array }) => void } })
    .__midi.onmidimessage({ data: new Uint8Array([0x90, 60, 100]) }))
  const banner = page.getByRole('button', { name: /Estás tocando pero el sonido está en pausa/ })
  await expect(banner).toBeVisible()
  await banner.click()
  await expect(banner).toBeHidden()
  // Tras el clic, las notas MIDI siguientes ya se reconocen (y suenan).
  await page.evaluate(() => {
    const m = (window as unknown as { __midi: { onmidimessage: (e: { data: Uint8Array }) => void } }).__midi
    ;[60, 64, 67].forEach((n) => m.onmidimessage({ data: new Uint8Array([0x90, n, 100]) }))
  })
  await expect(page.locator('.chord-big').first()).toHaveText('C')
})
