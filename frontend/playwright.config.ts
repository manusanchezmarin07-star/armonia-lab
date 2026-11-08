import { defineConfig, devices } from '@playwright/test'

// Los tests e2e arrancan el backend real (que sirve la web compilada en dist/).
// PYTHON permite indicar el intérprete del entorno virtual.
const python = process.env.PYTHON ?? 'python'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:8766', trace: 'off' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 950 } }, testIgnore: /(movil|audio|midi)\.spec\.ts/ },
    // Política de autoplay real de Chrome (en headless suele estar relajada).
    { name: 'audio', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--autoplay-policy=user-gesture-required'] } }, testMatch: /(audio|midi)\.spec\.ts/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /movil\.spec\.ts/ },
  ],
  webServer: {
    command: `${python} -m uvicorn app.main:app --host 127.0.0.1 --port 8766`,
    cwd: '../backend',
    url: 'http://127.0.0.1:8766/api/health',
    reuseExistingServer: !process.env.CI,
    env: { ARMONIA_DATA_DIR: '../.e2e-data' },
    timeout: 60_000,
  },
})
