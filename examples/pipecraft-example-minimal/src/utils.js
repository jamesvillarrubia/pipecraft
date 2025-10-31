/**
 * Utility Functions
 *
 * Simple utility functions for the minimal example application.
 */

/**
 * Create a greeting message
 * @param {string} name - Name to greet
 * @returns {string} Greeting message
 */
export function greet(name) {
  return `Hello, ${name}!`;
}

/**
 * Add two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export function add(a, b) {
  return a + b;
}

/**
 * Multiply two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of a and b
 */
export function multiply(a, b) {
  return a * b;
}
