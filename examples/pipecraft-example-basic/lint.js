#!/usr/bin/env node

/**
 * Linter Script for Multi-Domain Example
 *
 * Lints all code in the repository.
 * In a real application, this might run ESLint, Prettier, etc.
 */

const domains = ['frontend', 'backend', 'api', 'shared']

console.log('🔍 Linting code...\n')

// Lint each domain
for (const domain of domains) {
  console.log(`Linting ${domain}...`)
  console.log(`  ✓ Checking code style`)
  console.log(`  ✓ Checking for errors`)
  console.log(`  ✓ ${domain} passed linting\n`)
}

console.log('✅ Linting completed successfully!\n')

// Exit with success code
process.exit(0)
