import { defineConfig } from 'vitest/config'

// Tests unitarios de la lógica pura del frontend (sin navegador ni audio).
export default defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node' } })
