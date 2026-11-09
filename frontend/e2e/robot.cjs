// Robot exploratorio (no forma parte de la suite): node e2e/robot.cjs con la app en http://localhost:8765.
// Pulsa todos los controles de cada pantalla y lista errores de consola, excepciones y peticiones fallidas.
// Robot de interfaz: pulsa todos los controles de cada pantalla y registra problemas.
const { chromium } = require('playwright');
const PAGES = ['/', '/laboratorio', '/puentes', '/rearmonizar', '/escalas', '/negativa', '/analizador', '/ritmo', '/oido', '/lectura', '/pistas', '/bach', '/biblioteca', '/asistente'];
const SKIP = /Borrar|Eliminar|Quitar validación|Exportar|Grabar|■|Arrastra|Transcribir|↻|Reiniciar estad|Restaurar/i;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const problems = [];
  for (const path of PAGES) {
    const p = await ctx.newPage();
    let current = '';
    p.on('pageerror', (e) => problems.push(`${path} [${current}] EXCEPCIÓN: ${e.message.slice(0, 160)}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/salamander|favicon/.test(m.text())) problems.push(`${path} [${current}] CONSOLA: ${m.text().slice(0, 160)}`) });
    p.on('response', (r) => { if (r.status() >= 500 || (r.status() >= 400 && r.url().includes('/api/') && r.request().method() === 'GET')) problems.push(`${path} [${current}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace('http://localhost:8765', '')}`) });
    p.on('dialog', (d) => d.dismiss());
    await p.goto('http://localhost:8765' + path, { waitUntil: 'networkidle' });
    if (path === '/pistas') { await p.locator('.list-item').first().click(); await p.waitForTimeout(800) }
    const count = await p.locator('main button:visible, main select:visible, main input[type=checkbox]:visible, main .seq-item:visible, main .list-item:visible, main .bar:visible').count();
    let clicked = 0;
    for (let i = 0; i < Math.min(count, 120); i++) {
      const el = p.locator('main button:visible, main select:visible, main input[type=checkbox]:visible, main .seq-item:visible, main .list-item:visible, main .bar:visible').nth(i);
      try {
        const label = ((await el.textContent({ timeout: 500 })) || (await el.getAttribute('aria-label')) || '').trim().slice(0, 40);
        if (SKIP.test(label)) continue;
        current = label || `#${i}`;
        const tag = await el.evaluate((e) => e.tagName);
        if (tag === 'SELECT') {
          const opts = await el.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
          if (opts.length) await el.selectOption(opts[Math.min(1, opts.length - 1)], { timeout: 1000 });
        } else await el.click({ timeout: 1000 });
        clicked++;
        await p.waitForTimeout(120);
        // Cerrar ventanas que se hayan abierto (tutor, panel MIDI, tour…).
        if (await p.locator('.modal-backdrop, .tour-layer').count()) await p.keyboard.press('Escape');
        if (!p.url().includes(path === '/' ? 'localhost:8765/' : path)) { await p.goto('http://localhost:8765' + path, { waitUntil: 'networkidle' }); if (path === '/pistas') { await p.locator('.list-item').first().click(); await p.waitForTimeout(500) } }
      } catch (e) { /* elemento que desapareció tras otro clic: normal */ }
    }
    console.log(`${path}: ${clicked} controles pulsados`);
    await p.close();
  }
  console.log(problems.length ? '\nPROBLEMAS:\n' + [...new Set(problems)].join('\n') : '\nSIN PROBLEMAS');
  await b.close();
})();
