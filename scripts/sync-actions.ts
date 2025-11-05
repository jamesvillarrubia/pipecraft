#!/usr/bin/env tsx
/**
 * Sync Actions Script
 *
 * Ensures that /actions/ directory is in sync with src/templates/actions/*.tpl.ts
 * templates. This script regenerates all actions from their templates and can
 * verify or update the /actions/ directory.
 *
 * Usage:
 *   pnpm sync-actions          # Regenerate all actions
 *   pnpm sync-actions --check  # Verify sync without changes
 *   pnpm sync-actions --verify # Same as --check
 *
 * Exit codes:
 *   0 - Success (sync or verification passed)
 *   1 - Verification failed (out of sync)
 *   2 - Error during generation
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Parse command line arguments
const args = process.argv.slice(2)
const checkMode = args.includes('--check') || args.includes('--verify')

console.log(`\n🔄 Action Sync ${checkMode ? '(Verification Mode)' : '(Regeneration Mode)'}\n`)

/**
 * Action templates and their output paths
 */
const ACTION_TEMPLATES = [
  { name: 'calculate-version', path: 'actions/calculate-version/action.yml' },
  { name: 'create-pr', path: 'actions/create-pr/action.yml' },
  { name: 'create-release', path: 'actions/create-release/action.yml' },
  { name: 'create-tag', path: 'actions/create-tag/action.yml' },
  { name: 'detect-changes', path: 'actions/detect-changes/action.yml' },
  { name: 'manage-branch', path: 'actions/manage-branch/action.yml' },
  { name: 'promote-branch', path: 'actions/promote-branch/action.yml' },
  { name: 'run-nx-affected', path: 'actions/run-nx-affected/action.yml', optional: true }
]

/**
 * Generate actions from templates by running a minimal PipeCraft generation
 */
function generateActionsFromTemplates(): void {
  console.log('📝 Generating actions from templates...\n')

  try {
    // Create a temporary test directory
    const tempDir = path.join(rootDir, '.tmp-action-sync')

    // Clean up any existing temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }

    fs.mkdirSync(tempDir, { recursive: true })

    // Create a minimal .pipecraftrc.json for generation
    const minimalConfig = {
      packageManager: 'pnpm',
      strategy: 'path-based',
      domains: { api: ['api/**'], web: ['web/**'] },
      branchFlow: ['develop', 'main'],
      autoMerge: { main: false }
    }

    fs.writeFileSync(
      path.join(tempDir, '.pipecraftrc.json'),
      JSON.stringify(minimalConfig, null, 2)
    )

    // Initialize git (required for some templates)
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })

    // Run PipeCraft generator in temp directory
    console.log('   Running PipeCraft generator...')
    execSync('node dist/cli/index.js generate --force', {
      cwd: rootDir,
      env: { ...process.env, PWD: tempDir },
      stdio: 'pipe'
    })

    // Copy generated actions to root /actions directory
    const generatedActionsDir = path.join(tempDir, 'actions')
    const targetActionsDir = path.join(rootDir, 'actions')

    if (!checkMode) {
      console.log('   Copying generated actions to /actions/...')

      // Ensure target directory exists
      if (!fs.existsSync(targetActionsDir)) {
        fs.mkdirSync(targetActionsDir, { recursive: true })
      }

      // Copy each action
      for (const action of ACTION_TEMPLATES) {
        const actionName = action.name
        const sourceDir = path.join(generatedActionsDir, actionName)
        const targetDir = path.join(targetActionsDir, actionName)

        if (fs.existsSync(sourceDir)) {
          // Remove existing target directory
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true })
          }

          // Copy new version
          fs.cpSync(sourceDir, targetDir, { recursive: true })
          console.log(`   ✅ ${actionName}`)
        }
      }
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })

    if (!checkMode) {
      console.log('\n✅ Actions regenerated successfully!\n')
    }
  } catch (error) {
    console.error('\n❌ Error generating actions:', error)
    process.exit(2)
  }
}

/**
 * Verify that /actions/ matches the templates
 */
function verifySync(): boolean {
  console.log('🔍 Verifying sync between templates and /actions/...\n')

  const actionsDir = path.join(rootDir, 'actions')
  let allMatch = true

  for (const action of ACTION_TEMPLATES) {
    const actionPath = path.join(rootDir, action.path)

    if (!fs.existsSync(actionPath)) {
      if ((action as any).optional) {
        console.log(`   ⚠️  ${action.name}: Optional (not generated)`)
        continue
      }
      console.log(`   ❌ ${action.name}: Missing (action file not found)`)
      allMatch = false
      continue
    }

    const templatePath = path.join(rootDir, 'src/templates/actions', `${action.name}.yml.tpl.ts`)

    if (!fs.existsSync(templatePath)) {
      console.log(`   ⚠️  ${action.name}: Template not found`)
      continue
    }

    // Check file modification times
    const actionStat = fs.statSync(actionPath)
    const templateStat = fs.statSync(templatePath)

    if (templateStat.mtime > actionStat.mtime) {
      console.log(`   ❌ ${action.name}: Template newer than action`)
      allMatch = false
    } else {
      console.log(`   ✅ ${action.name}`)
    }
  }

  return allMatch
}

/**
 * Main execution
 */
function main(): void {
  try {
    // Build the project first to ensure latest templates
    console.log('🔨 Building project...\n')
    execSync('pnpm run build', { cwd: rootDir, stdio: 'inherit' })

    if (checkMode) {
      // Verification mode - check if in sync
      const isInSync = verifySync()

      if (!isInSync) {
        console.log('\n❌ Actions are out of sync with templates!')
        console.log('   Run `pnpm sync-actions` to regenerate.\n')
        process.exit(1)
      }

      console.log('\n✅ All actions are in sync with templates!\n')
      process.exit(0)
    } else {
      // Regeneration mode - generate from templates
      generateActionsFromTemplates()

      console.log('💡 Next steps:')
      console.log('   1. Review changes: git diff actions/')
      console.log('   2. Commit if correct: git add actions/ && git commit\n')

      process.exit(0)
    }
  } catch (error) {
    console.error('\n❌ Sync failed:', error)
    process.exit(2)
  }
}

main()
