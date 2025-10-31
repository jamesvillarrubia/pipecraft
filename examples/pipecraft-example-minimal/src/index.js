/**
 * Minimal Example Application
 *
 * This is a simple application demonstrating PipeCraft's trunk-based workflow.
 * It serves as the simplest possible starting point for new users.
 */

import { greet, add } from './utils.js'

function main() {
  console.log(greet('PipeCraft'))
  console.log(`2 + 2 = ${add(2, 2)}`)
  console.log('✓ Application running successfully')
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
