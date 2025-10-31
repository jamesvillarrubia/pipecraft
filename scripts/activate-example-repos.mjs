#!/usr/bin/env node
/**
 * Activate example git repos for testing
 * 
 * Renames .git.stored directories back to .git so repos are functional
 * for running tests.
 */

import { readdir, rename, access } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'

const EXAMPLES_DIR = 'examples'
const REPOS = ['pipecraft-example-basic', 'pipecraft-example-gated', 'pipecraft-example-minimal']

async function activateRepo(repoName) {
  const repoPath = join(EXAMPLES_DIR, repoName)
  const storedGitPath = join(repoPath, '.git.stored')
  const activeGitPath = join(repoPath, '.git')

  try {
    await access(storedGitPath)
  } catch {
    console.log(`ℹ ${repoName}: No .git.stored found (skipping)`)
    return
  }

  // Remove active .git if it exists (shouldn't normally)
  try {
    await access(activeGitPath)
    const { rmSync } = await import('fs')
    rmSync(activeGitPath, { recursive: true, force: true })
  } catch {
    // Doesn't exist, that's fine
  }

  // Rename .git.stored to .git
  await rename(storedGitPath, activeGitPath)
  console.log(`✓ Activated git repo: ${repoName}`)

  // Ensure remote is set (use default test remote)
  const remoteUrl = `https://github.com/test/${repoName}.git`
  try {
    execSync('git remote remove origin', { cwd: repoPath, stdio: 'pipe' })
  } catch {
    // Remote might not exist
  }
  execSync(`git remote add origin ${remoteUrl}`, { cwd: repoPath, stdio: 'pipe' })
}

async function main() {
  console.log('Activating example git repos for testing...\n')
  
  for (const repo of REPOS) {
    await activateRepo(repo)
  }
  
  console.log('\n✓ All example repos activated')
}

main().catch(console.error)

