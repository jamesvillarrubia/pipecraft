import { execSync } from 'child_process'

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    })
  } catch (error) {
    if (options.throwOnError !== false) {
      throw error
    }
    return null
  }
}

export function checkGitRepo() {
  const result = exec('git rev-parse --git-dir', { silent: true, throwOnError: false })
  return result !== null
}

export function getCurrentBranch() {
  return exec('git branch --show-current', { silent: true }).trim()
}

export function checkTagExists(tagName) {
  const result = exec(`git tag -l ${tagName}`, { silent: true })
  return result.trim() === tagName
}

export function createBaselineTag() {
  const tagName = 'pipecraft-test-baseline'

  if (checkTagExists(tagName)) {
    console.log(`  ℹ️  Baseline tag already exists: ${tagName}`)
    return tagName
  }

  exec(`git tag -a ${tagName} -m "Clean baseline before PipeCraft testing"`)
  console.log(`  ✅ Created baseline tag: ${tagName}`)
  return tagName
}

export function createTestBranch() {
  const timestamp = Date.now()
  const branchName = `pipecraft-test-run-${timestamp}`

  exec(`git checkout -b ${branchName}`)
  console.log(`  ✅ Created test branch: ${branchName}`)
  return branchName
}

export function resetToBaseline() {
  const tagName = 'pipecraft-test-baseline'

  if (!checkTagExists(tagName)) {
    throw new Error(`Baseline tag ${tagName} does not exist. Run createBaselineTag() first.`)
  }

  console.log(`  🔄 Resetting to baseline tag: ${tagName}`)
  exec(`git reset --hard ${tagName}`)
  exec(`git clean -fd`)
  console.log(`  ✅ Reset to baseline complete`)
}

export function createTestCommit(message, files = []) {
  if (files.length > 0) {
    exec(`git add ${files.join(' ')}`)
  }

  exec(`git commit --allow-empty -m "${message}"`)
  console.log(`  ✅ Created test commit: ${message}`)
}

export function getCommitsSince(ref) {
  const output = exec(`git log ${ref}..HEAD --oneline`, { silent: true })
  return output.trim().split('\n').filter(Boolean)
}

export function getCurrentCommitHash() {
  return exec('git rev-parse HEAD', { silent: true }).trim()
}

export function deleteTestBranches() {
  const branches = exec('git branch --list "pipecraft-test-run-*"', { silent: true })
  const branchList = branches.trim().split('\n').filter(Boolean).map(b => b.trim())

  if (branchList.length === 0) {
    console.log('  ℹ️  No test branches to delete')
    return
  }

  const currentBranch = getCurrentBranch()

  for (const branch of branchList) {
    if (branch === currentBranch) {
      console.log(`  ⚠️  Skipping current branch: ${branch}`)
      continue
    }

    exec(`git branch -D ${branch}`)
    console.log(`  ✅ Deleted test branch: ${branch}`)
  }
}

export function stashChanges() {
  exec('git stash push -m "PipeCraft test stash"')
  console.log('  ✅ Stashed uncommitted changes')
}

export function popStash() {
  exec('git stash pop')
  console.log('  ✅ Restored stashed changes')
}
