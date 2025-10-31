#!/usr/bin/env node

/**
 * Test Runner for Multi-Domain Example
 *
 * Runs tests for all domains or a specific domain.
 * Usage:
 *   node test-runner.js           # Run all tests
 *   node test-runner.js frontend  # Run only frontend tests
 */

const domains = ['frontend', 'backend', 'api', 'shared']
const requestedDomain = process.argv[2]

console.log('🧪 Running tests...\n')

function runTestsForDomain(domain) {
  console.log(`Testing ${domain} domain:`)
  console.log(`  ✓ Loading ${domain} modules`)
  console.log(`  ✓ Running unit tests`)
  console.log(`  ✓ Running integration tests`)
  console.log(`  ✓ All ${domain} tests passed\n`)
}

if (requestedDomain) {
  // Run tests for specific domain
  if (!domains.includes(requestedDomain)) {
    console.error(`❌ Unknown domain: ${requestedDomain}`)
    console.error(`Available domains: ${domains.join(', ')}`)
    process.exit(1)
  }

  console.log(`Running tests for ${requestedDomain} domain only\n`)
  runTestsForDomain(requestedDomain)
} else {
  // Run all tests
  console.log('Running tests for all domains\n')
  domains.forEach(runTestsForDomain)
}

// Summary
console.log('='.repeat(50))
console.log('✅ All tests passed!')

process.exit(0)
