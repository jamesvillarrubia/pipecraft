import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/examples/**/*.spec.ts',
      '**/examples/**/*.test.ts',
      '**/examples/**/*.spec.js',
      '**/examples/**/*.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Include core business logic AND orchestration code (generators, templates, utils)
      // Note: CLI (src/cli/index.ts) is entry point tested via integration tests
      include: ['src/utils/**/*.ts', 'src/templates/workflows/**/*.ts', 'src/generators/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'examples/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      // Thresholds based on actual testable code (CLI + generators + core logic)
      // Starting at 60%, with goal to gradually increase to 75%+
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      },
      // Report per-file thresholds
      perFile: true,
      // Include all source files in report
      all: true,
      // Additional config for better reporting
      clean: true,
      skipFull: false
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
