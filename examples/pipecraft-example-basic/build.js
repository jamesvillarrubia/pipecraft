#!/usr/bin/env node

/**
 * Build Script for Multi-Domain Example
 *
 * Builds all domains in the correct order.
 * In a real application, this might compile TypeScript, bundle assets, etc.
 */

const domains = ['shared', 'frontend', 'backend', 'api']

console.log('🔨 Building multi-domain application...\n')

console.log('Domain build order:')
domains.forEach((domain, index) => {
  console.log(`  ${index + 1}. ${domain}`)
})
console.log('')

// Simulate build for each domain
for (const domain of domains) {
  console.log(`Building ${domain}...`)
  console.log(`  ✓ Checking source files`)
  console.log(`  ✓ Processing dependencies`)
  console.log(`  ✓ Generating output`)
  console.log(`  ✓ ${domain} built successfully\n`)
}

console.log('✅ All domains built successfully!\n')

// Exit with success code
process.exit(0)
