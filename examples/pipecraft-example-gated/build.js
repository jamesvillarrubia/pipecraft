#!/usr/bin/env node

/**
 * Build Script for Gated Example
 *
 * Builds all domains for enterprise deployment.
 */

const domains = ['shared', 'services', 'api', 'web'];

console.log('🔨 Building enterprise application...\n');

console.log('Build order (dependency-aware):');
domains.forEach((domain, index) => {
  console.log(`  ${index + 1}. ${domain}`);
});
console.log('');

// Simulate build for each domain
for (const domain of domains) {
  console.log(`Building ${domain}...`);
  console.log(`  ✓ Type checking`);
  console.log(`  ✓ Compiling source`);
  console.log(`  ✓ Bundling assets`);
  console.log(`  ✓ Generating artifacts`);
  console.log(`  ✓ ${domain} built successfully\n`);
}

console.log('✅ All domains built successfully!');
console.log('📦 Build artifacts ready for deployment\n');

process.exit(0);
