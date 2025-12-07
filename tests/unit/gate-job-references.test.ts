/**
 * Gate Job References Test
 * 
 * Tests that the gate job only references jobs that actually exist in the workflow,
 * not jobs that are configured but not yet created.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { parseDocument } from 'yaml'

describe('Gate Job References', () => {
  let testDir: string
  const cliPath = join(process.cwd(), 'dist', 'cli', 'index.js')

  beforeEach(() => {
    testDir = join(process.cwd(), 'tests', 'tmp', `gate-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })

    // Initialize git repo
    execSync('git init', { cwd: testDir })
    execSync('git config user.email "test@example.com"', { cwd: testDir })
    execSync('git config user.name "Test User"', { cwd: testDir })
    // Add a dummy remote to pass preflight checks
    execSync('git remote add origin https://github.com/test/test.git', { cwd: testDir })

    // Create package.json
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2)
    )
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should only reference existing custom jobs in gate for existing workflow', async () => {
    // Create a config with three domains
    const config = {
      ciProvider: 'github',
      domains: {
        api: { paths: ['apps/api/**'] },
        web: { paths: ['apps/web/**'] },
        shared: { paths: ['libs/shared/**'] }
      },
      branchFlow: ['develop', 'main'],
      finalBranch: 'main'
    }

    writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config, null, 2))

    // First generation - creates all placeholder jobs
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    const workflowPath = join(testDir, '.github', 'workflows', 'pipeline.yml')
    expect(existsSync(workflowPath)).toBe(true)

    // Read the generated workflow
    let workflowContent = readFileSync(workflowPath, 'utf8')
    let doc = parseDocument(workflowContent)
    
    // Verify all three test jobs were created
    const jobs = (doc.contents as any).get('jobs')
    expect(jobs.has('test-api')).toBe(true)
    expect(jobs.has('test-web')).toBe(true)
    expect(jobs.has('test-shared')).toBe(true)

    // Verify gate job references all three test jobs
    const gateJob = jobs.get('gate')
    expect(gateJob).toBeDefined()
    const gateNeeds = gateJob.get('needs')
    const needsArray = gateNeeds.items.map((item: any) => item.value)
    expect(needsArray).toContain('test-api')
    expect(needsArray).toContain('test-web')
    expect(needsArray).toContain('test-shared')

    // Now, manually delete test-web job to simulate user removing a job
    workflowContent = workflowContent.replace(/\n\s+test-web:[\s\S]*?(?=\n\s+test-shared:|\n\s+#|$)/m, '')
    writeFileSync(workflowPath, workflowContent)

    // Verify test-web was removed
    doc = parseDocument(readFileSync(workflowPath, 'utf8'))
    const jobsAfterDelete = (doc.contents as any).get('jobs')
    expect(jobsAfterDelete.has('test-api')).toBe(true)
    expect(jobsAfterDelete.has('test-web')).toBe(false)
    expect(jobsAfterDelete.has('test-shared')).toBe(true)

    // Regenerate the workflow
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    // Read the regenerated workflow
    const regeneratedContent = readFileSync(workflowPath, 'utf8')
    doc = parseDocument(regeneratedContent)
    
    // Verify gate job now only references the existing jobs (test-api and test-shared)
    const jobsAfterRegen = (doc.contents as any).get('jobs')
    const gateJobAfterRegen = jobsAfterRegen.get('gate')
    expect(gateJobAfterRegen).toBeDefined()
    
    const gateNeedsAfterRegen = gateJobAfterRegen.get('needs')
    const needsArrayAfterRegen = gateNeedsAfterRegen.items.map((item: any) => item.value)
    
    // Should include existing jobs
    expect(needsArrayAfterRegen).toContain('test-api')
    expect(needsArrayAfterRegen).toContain('test-shared')
    
    // Should NOT include deleted job
    expect(needsArrayAfterRegen).not.toContain('test-web')
    
    // Should still include version job
    expect(needsArrayAfterRegen).toContain('version')

    // Verify gate condition also doesn't reference deleted job
    const gateIf = gateJobAfterRegen.get('if')
    const gateCondition = gateIf.value
    expect(gateCondition).not.toContain('test-web')
    expect(gateCondition).toContain('test-api')
    expect(gateCondition).toContain('test-shared')
  })

  it('should use configured jobs for new workflow generation', async () => {
    // Create a config with two domains
    const config = {
      ciProvider: 'github',
      domains: {
        api: { paths: ['apps/api/**'] },
        web: { paths: ['apps/web/**'] }
      },
      branchFlow: ['develop', 'main'],
      finalBranch: 'main'
    }

    writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config, null, 2))

    // Generate workflow for the first time
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    const workflowPath = join(testDir, '.github', 'workflows', 'pipeline.yml')
    const workflowContent = readFileSync(workflowPath, 'utf8')
    const doc = parseDocument(workflowContent)
    
    // Verify gate job references configured jobs
    const jobs = (doc.contents as any).get('jobs')
    const gateJob = jobs.get('gate')
    expect(gateJob).toBeDefined()
    
    const gateNeeds = gateJob.get('needs')
    const needsArray = gateNeeds.items.map((item: any) => item.value)
    
    // Should include version and both configured test jobs
    expect(needsArray).toContain('version')
    expect(needsArray).toContain('test-api')
    expect(needsArray).toContain('test-web')
  })

  it('should handle workflow with no custom jobs gracefully', async () => {
    // Create a config
    const config = {
      ciProvider: 'github',
      domains: {
        api: { paths: ['apps/api/**'] }
      },
      branchFlow: ['develop', 'main'],
      finalBranch: 'main'
    }

    writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config, null, 2))

    // First generation
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    const workflowPath = join(testDir, '.github', 'workflows', 'pipeline.yml')
    
    // Delete all custom jobs
    let workflowContent = readFileSync(workflowPath, 'utf8')
    // Remove everything between the custom job markers
    workflowContent = workflowContent.replace(
      /# <--START CUSTOM JOBS-->[\s\S]*?# <--END CUSTOM JOBS-->/,
      '# <--START CUSTOM JOBS-->\n\n  # <--END CUSTOM JOBS-->'
    )
    writeFileSync(workflowPath, workflowContent)

    // Regenerate
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    // Verify workflow still valid
    const regeneratedContent = readFileSync(workflowPath, 'utf8')
    const doc = parseDocument(regeneratedContent)
    
    const jobs = (doc.contents as any).get('jobs')
    const gateJob = jobs.get('gate')
    expect(gateJob).toBeDefined()
    
    // Gate should only depend on version when no custom jobs exist
    const gateNeeds = gateJob.get('needs')
    const needsArray = gateNeeds.items.map((item: any) => item.value)
    expect(needsArray).toEqual(['version'])
    
    // Gate should have a simple success condition
    const gateIf = gateJob.get('if')
    expect(gateIf.value).toContain("needs.version.result == 'success'")
  })

  it('should handle mixed job types in gate dependencies', async () => {
    // Create a config with domains
    const config = {
      ciProvider: 'github',
      domains: {
        api: { paths: ['apps/api/**'] }
      },
      branchFlow: ['develop', 'main'],
      finalBranch: 'main'
    }

    writeFileSync(join(testDir, '.pipecraftrc'), JSON.stringify(config, null, 2))

    // First generation
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    const workflowPath = join(testDir, '.github', 'workflows', 'pipeline.yml')
    let workflowContent = readFileSync(workflowPath, 'utf8')

    // Add a custom lint job manually in the custom section
    const customLintJob = `
  lint-api:
    needs: changes
    if: \${{ needs.changes.outputs.api == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint API
        run: echo "Linting API"
`
    
    // Insert the lint job in the custom section
    workflowContent = workflowContent.replace(
      /# <--START CUSTOM JOBS-->\n/,
      `# <--START CUSTOM JOBS-->\n${customLintJob}\n`
    )
    writeFileSync(workflowPath, workflowContent)

    // Regenerate
    execSync(`node ${cliPath} generate`, { 
      cwd: testDir,
      stdio: 'pipe'
    })

    // Verify gate includes both test and lint jobs
    const regeneratedContent = readFileSync(workflowPath, 'utf8')
    const doc = parseDocument(regeneratedContent)
    
    const jobs = (doc.contents as any).get('jobs')
    const gateJob = jobs.get('gate')
    
    const gateNeeds = gateJob.get('needs')
    const needsArray = gateNeeds.items.map((item: any) => item.value)
    
    expect(needsArray).toContain('test-api')
    expect(needsArray).toContain('lint-api')
    expect(needsArray).toContain('version')
  })
})
