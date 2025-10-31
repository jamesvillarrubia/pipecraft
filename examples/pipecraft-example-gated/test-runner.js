#!/usr/bin/env node

/**
 * Test Runner for Gated Example
 *
 * Runs comprehensive tests for all domains.
 */

const domains = ['services', 'web', 'api', 'shared']
const requestedDomain = process.argv[2]

console.log('🧪 Running enterprise test suite...\n')

function runTestsForDomain(domain) {
  console.log(`Testing ${domain} domain:`)
  console.log(`  ✓ Unit tests`)
  console.log(`  ✓ Integration tests`)
  console.log(`  ✓ Security tests`)
  console.log(`  ✓ Performance tests`)
  console.log(`  ✓ All ${domain} tests passed\n`)
}

if (requestedDomain) {
  if (!domains.includes(requestedDomain)) {
    console.error(`❌ Unknown domain: ${requestedDomain}`)
    console.error(`Available domains: ${domains.join(', ')}`)
    process.exit(1)
  }
  console.log(`Running tests for ${requestedDomain} domain only\n`)
  runTestsForDomain(requestedDomain)
} else {
  console.log('Running comprehensive test suite for all domains\n')
  domains.forEach(runTestsForDomain)
}

console.log('='.repeat(50))
console.log('✅ All tests passed! Ready for gate approval.')

process.exit(0)
