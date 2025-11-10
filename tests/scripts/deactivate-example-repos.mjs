#!/usr/bin/env node

/**
 * Deactivate example git repos after testing
 *
 * Renames .git directories back to .git.stored and resets working trees
 * to return repos to their clean tracked state.
 */

import { execSync } from 'child_process'
import { rmSync } from 'fs'
import { access, readdir, rename } from 'fs/promises'
import { join } from 'path'

const EXAMPLES_DIR = 'examples'
const REPOS = ['pipecraft-example-basic', 'pipecraft-example-gated', 'pipecraft-example-minimal']

async function deactivateRepo(repoName, resetWorkingTree = true) {
  const repoPath = join(EXAMPLES_DIR, repoName)
  const activeGitPath = join(repoPath, '.git')
  const storedGitPath = join(repoPath, '.git.stored')

  try {
    await access(activeGitPath)
  } catch {
    console.log(`ℹ ${repoName}: No .git found (already deactivated)`)
    return
  }

  // Reset working tree to clean state
  if (resetWorkingTree) {
    try {
      execSync('git reset --hard HEAD', { cwd: repoPath, stdio: 'pipe' })
      execSync('git clean -fd', { cwd: repoPath, stdio: 'pipe' })
    } catch (error) {
      // Repo might not have commits yet, that's fine
    }
  }

  // Remove old stored version if it exists
  try {
    await access(storedGitPath)
    rmSync(storedGitPath, { recursive: true, force: true })
  } catch {
    // Doesn't exist, that's fine
  }

  // Rename .git back to .git.stored
  await rename(activeGitPath, storedGitPath)
  console.log(`✓ Deactivated git repo: ${repoName}`)
}

async function main() {
  const resetWorkingTree = !process.argv.includes('--keep-changes')

  console.log('Deactivating example git repos...\n')

  for (const repo of REPOS) {
    await deactivateRepo(repo, resetWorkingTree)
  }

  console.log('\n✓ All example repos deactivated and stored')
}

main().catch(console.error)
