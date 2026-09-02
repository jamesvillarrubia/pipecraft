#!/usr/bin/env node

/**
 * `npx @thecraftlab/pipecraft-skill` installs the Pipecraft skill.
 *
 * The installation itself belongs to `pipecraft skill`, which knows all six target formats,
 * writes into a marked block so it never destroys a rules file the user owns, and can
 * uninstall exactly what it wrote. This forwards to it rather than carrying a second
 * implementation that would drift from the first.
 *
 * The previous version of this package ran `install-skill.js` from a `postinstall` hook. A
 * hook is the wrong mechanism twice over: `files` omitted the script, so every install
 * failed on a missing module, and pnpm blocks postinstall for unapproved dependencies by
 * default, so the installs that did resolve would have done nothing.
 */

import { spawnSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let cli
try {
  cli = require.resolve('pipecraft/dist/cli/index.js')
} catch {
  console.error('Could not resolve the pipecraft CLI, which this package depends on.')
  console.error('Install it and run the command directly:  npx pipecraft skill')
  process.exit(1)
}

const result = spawnSync(process.execPath, [cli, 'skill', ...process.argv.slice(2)], {
  stdio: 'inherit'
})

process.exit(result.status ?? 1)
