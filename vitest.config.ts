import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Include only core testable business logic
      include: [
        'src/utils/**/*.ts',
        'src/templates/workflows/**/*.ts'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      // Thresholds based on actual testable business logic
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
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
