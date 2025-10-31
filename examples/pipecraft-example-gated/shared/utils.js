/**
 * Shared Utilities
 *
 * Common functions used across all domains.
 */

export function formatDate(date) {
  return new Date(date).toISOString()
}

export function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function hashPassword(password) {
  // Placeholder - real implementation would use bcrypt
  console.log('Hashing password...')
  return `hashed-${password}`
}

export function logger(level, message) {
  console.log(`[${level.toUpperCase()}] ${message}`)
}
