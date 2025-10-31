/**
 * Tests for utility functions
 */

import { greet, add, multiply } from '../src/utils.js';

// Simple test assertions
function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
  console.log(`✓ ${message}`);
}

// Run tests
console.log('Running tests...\n');

// Test greet function
assertEquals(greet('World'), 'Hello, World!', 'greet() should return greeting message');
assertEquals(greet('PipeCraft'), 'Hello, PipeCraft!', 'greet() should work with any name');

// Test add function
assertEquals(add(2, 2), 4, 'add() should correctly add positive numbers');
assertEquals(add(-1, 1), 0, 'add() should handle negative numbers');
assertEquals(add(0, 0), 0, 'add() should handle zero');

// Test multiply function
assertEquals(multiply(2, 3), 6, 'multiply() should correctly multiply numbers');
assertEquals(multiply(5, 0), 0, 'multiply() should handle zero');
assertEquals(multiply(-2, 3), -6, 'multiply() should handle negative numbers');

console.log('\n✓ All tests passed!');
