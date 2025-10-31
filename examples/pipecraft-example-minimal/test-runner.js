#!/usr/bin/env node

/**
 * Simple Test Runner
 *
 * Runs all test files in the test/ directory.
 * This is a minimal test runner for demonstration purposes.
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = join(__dirname, 'test');

console.log('🧪 Running tests...\n');

// Find all test files
const testFiles = readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .map(file => join(testDir, file));

if (testFiles.length === 0) {
  console.log('⚠️  No test files found');
  process.exit(0);
}

// Run each test file
let failedTests = 0;

async function runTests() {
  for (const testFile of testFiles) {
    console.log(`Running ${testFile}...\n`);

    try {
      await new Promise((resolve, reject) => {
        const child = spawn('node', [testFile], {
          stdio: 'inherit'
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Test failed with code ${code}`));
          }
        });

        child.on('error', reject);
      });
    } catch (error) {
      console.error(`\n❌ Test failed: ${error.message}\n`);
      failedTests++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  if (failedTests === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log(`❌ ${failedTests} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
