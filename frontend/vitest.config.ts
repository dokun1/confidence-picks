import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/designsystem/platform-tokens/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/test-setup.ts',
      ],
    },
  },
})
