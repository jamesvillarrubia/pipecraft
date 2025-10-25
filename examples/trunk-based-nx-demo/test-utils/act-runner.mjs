import { execSync } from 'child_process'
import fs from 'fs/promises'

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    })
  } catch (error) {
    if (options.throwOnError !== false) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || ''
      }
    }
    throw error
  }
}

export function checkActInstalled() {
  console.log('🔍 Checking if act is installed...')

  const result = exec('which act', { silent: true, throwOnError: false })

  if (result && typeof result === 'string' && result.trim()) {
    console.log('  ✅ act is installed')
    const version = exec('act --version', { silent: true, throwOnError: false })
    if (version && typeof version === 'string') {
      console.log(`  ℹ️  Version: ${version.trim()}`)
    }
    return { installed: true }
  }

  console.log('  ❌ act is not installed')
  console.log('  ℹ️  Install with: brew install act (macOS) or visit https://github.com/nektos/act')

  return { installed: false }
}

export async function runAct(options = {}) {
  const {
    event = 'pull_request',
    job = null,
    workflow = '.github/workflows/pipeline.yml',
    dryRun = false,
    verbose = false,
    env = {}
  } = options

  console.log(`🎬 Running act with event: ${event}${job ? `, job: ${job}` : ''}`)

  const args = ['act', event]

  if (workflow) {
    args.push('-W', workflow)
  }

  if (job) {
    args.push('-j', job)
  }

  if (dryRun) {
    args.push('-n')
  }

  if (verbose) {
    args.push('-v')
  }

  // Add environment variables
  for (const [key, value] of Object.entries(env)) {
    args.push('--env', `${key}=${value}`)
  }

  const command = args.join(' ')

  console.log(`  💻 Command: ${command}`)

  const startTime = Date.now()
  const result = exec(command, { silent: !verbose, throwOnError: false })
  const duration = Date.now() - startTime

  if (result && typeof result === 'object' && !result.success) {
    console.log(`  ❌ act failed after ${duration}ms`)
    return {
      success: false,
      duration,
      error: result.error,
      stdout: result.stdout,
      stderr: result.stderr
    }
  }

  console.log(`  ✅ act completed in ${duration}ms`)

  return {
    success: true,
    duration,
    output: typeof result === 'string' ? result : result.stdout
  }
}

export async function runActScenario(scenario) {
  console.log(`\n📋 Running scenario: ${scenario.name}`)
  console.log(`   Description: ${scenario.description}`)

  const results = {
    name: scenario.name,
    description: scenario.description,
    changes: scenario.changes,
    success: true,
    steps: []
  }

  // Step 1: Make changes
  console.log('  📝 Making changes...')
  for (const file of scenario.changes) {
    try {
      await fs.appendFile(file, `\n// Test change for scenario: ${scenario.name}\n`)
      console.log(`    ✅ Modified: ${file}`)
    } catch (error) {
      console.log(`    ❌ Failed to modify: ${file}`)
      results.success = false
      results.error = error.message
      return results
    }
  }

  results.steps.push({ step: 'make-changes', success: true })

  // Step 2: Commit changes
  console.log('  📦 Committing changes...')
  try {
    exec(`git add ${scenario.changes.join(' ')}`)
    exec(`git commit -m "test: ${scenario.name}"`)
    console.log('    ✅ Changes committed')
    results.steps.push({ step: 'commit', success: true })
  } catch (error) {
    console.log('    ❌ Commit failed')
    results.success = false
    results.error = error.message
    return results
  }

  // Step 3: Run detect-changes job with act
  console.log('  🎬 Running detect-changes job...')
  const detectResult = await runAct({
    event: 'pull_request',
    job: 'detect-changes',
    verbose: false
  })

  results.steps.push({ step: 'detect-changes', success: detectResult.success })

  if (!detectResult.success) {
    console.log('    ❌ detect-changes job failed')
    results.success = false
    results.error = detectResult.error
    return results
  }

  console.log('    ✅ detect-changes job completed')

  // Step 4: Parse affected projects from output
  const affectedMatch = detectResult.output?.match(/affected[=:]([^\s\n]+)/i)
  const affected = affectedMatch ? affectedMatch[1].split(',').filter(Boolean) : []

  results.affected = affected
  results.expectedAffected = scenario.expectedAffected

  console.log(`    📊 Affected projects: ${affected.join(', ') || 'none'}`)

  // Step 5: Verify expected affected projects
  if (scenario.expectedAffected) {
    const missingProjects = scenario.expectedAffected.filter(p => !affected.includes(p))
    const unexpectedProjects = affected.filter(p => !scenario.expectedAffected.includes(p))

    if (missingProjects.length > 0) {
      console.log(`    ⚠️  Missing expected projects: ${missingProjects.join(', ')}`)
      results.missingProjects = missingProjects
    }

    if (unexpectedProjects.length > 0) {
      console.log(`    ℹ️  Unexpected projects affected: ${unexpectedProjects.join(', ')}`)
      results.unexpectedProjects = unexpectedProjects
    }

    const affectedMatch = missingProjects.length === 0
    results.affectedMatch = affectedMatch

    if (affectedMatch) {
      console.log('    ✅ Affected projects match expectations')
    } else {
      console.log('    ❌ Affected projects do not match expectations')
      results.success = false
    }
  }

  // Step 6: Run expected jobs (if specified)
  if (scenario.expectedJobs && scenario.expectedJobs.length > 0) {
    console.log('  🎬 Running expected jobs...')
    results.jobResults = []

    for (const jobName of scenario.expectedJobs) {
      console.log(`    Running job: ${jobName}`)

      const jobResult = await runAct({
        event: 'pull_request',
        job: jobName,
        verbose: false
      })

      results.jobResults.push({
        job: jobName,
        success: jobResult.success,
        duration: jobResult.duration
      })

      if (jobResult.success) {
        console.log(`      ✅ ${jobName} passed`)
      } else {
        console.log(`      ❌ ${jobName} failed`)
        results.success = false
      }
    }
  }

  if (results.success) {
    console.log(`  ✅ Scenario passed: ${scenario.name}`)
  } else {
    console.log(`  ❌ Scenario failed: ${scenario.name}`)
  }

  return results
}

export async function runActScenarios(scenarios) {
  console.log(`\n🎯 Running ${scenarios.length} test scenarios...\n`)

  const results = []

  for (const scenario of scenarios) {
    const result = await runActScenario(scenario)
    results.push(result)
  }

  const passedCount = results.filter(r => r.success).length
  const failedCount = results.length - passedCount

  console.log(`\n📊 Scenario Results:`)
  console.log(`  ✅ Passed: ${passedCount}`)
  console.log(`  ❌ Failed: ${failedCount}`)
  console.log(`  📈 Total: ${results.length}`)

  return {
    results,
    passedCount,
    failedCount,
    totalCount: results.length,
    allPassed: failedCount === 0
  }
}

export function parseActOutput(output) {
  const lines = output.split('\n')
  const jobs = []
  let currentJob = null

  for (const line of lines) {
    const jobStartMatch = line.match(/\[(.+?)\]\s+(.+)/)

    if (jobStartMatch) {
      const [, jobName, message] = jobStartMatch

      if (message.includes('Starting')) {
        currentJob = { name: jobName, steps: [], success: null }
        jobs.push(currentJob)
      } else if (currentJob) {
        currentJob.steps.push(message)

        if (message.includes('success')) {
          currentJob.success = true
        } else if (message.includes('failure') || message.includes('failed')) {
          currentJob.success = false
        }
      }
    }
  }

  return jobs
}
