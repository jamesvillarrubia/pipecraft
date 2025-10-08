#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// Mock GitHub environment variables
const mockGitHubEnv = {
  GITHUB_ACTIONS: 'true',
  GITHUB_WORKFLOW: 'test-workflow',
  GITHUB_RUN_ID: '123456789',
  GITHUB_RUN_NUMBER: '1',
  GITHUB_ACTOR: 'test-user',
  GITHUB_REPOSITORY: 'test-org/test-repo',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_SHA: 'abc123def456',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_HEAD_REF: '',
  GITHUB_BASE_REF: '',
  GITHUB_WORKSPACE: process.cwd(),
  GITHUB_TOKEN: 'fake-token-for-testing'
}

// Mock secrets
const mockSecrets = {
  GITHUB_TOKEN: 'fake-token-for-testing',
  NPM_TOKEN: 'fake-npm-token',
  DOCKER_USERNAME: 'fake-docker-user',
  DOCKER_PASSWORD: 'fake-docker-password'
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`)
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...mockGitHubEnv, ...mockSecrets },
      ...options
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })
  })
}

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...')
  
  // Create .github/workflows directory if it doesn't exist
  const workflowsDir = join(process.cwd(), '.github', 'workflows')
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true })
  }
  
  // Create a test configuration
  const testConfig = {
    ciProvider: 'github',
    mergeStrategy: 'fast-forward',
    requireConventionalCommits: true,
    initialBranch: 'develop',
    finalBranch: 'main',
    branchFlow: ['develop', 'staging', 'main'],
    semver: {
      bumpRules: {
        feat: 'minor',
        fix: 'patch',
        breaking: 'major'
      }
    },
    actions: {
      onDevelopMerge: [],
      onStagingMerge: []
    },
    domains: {
      api: {
        paths: ['src/api/**', 'apps/api/**'],
        description: 'API service changes',
        testable: true,
        deployable: true
      },
      web: {
        paths: ['src/web/**', 'apps/web/**'],
        description: 'Web application changes',
        testable: true,
        deployable: true
      },
      mobile: {
        paths: ['src/mobile/**', 'apps/mobile/**'],
        description: 'Mobile app changes',
        testable: false,
        deployable: true
      },
      cicd: {
        paths: ['.github/workflows/**'],
        description: 'CI/CD configuration changes',
        testable: true,
        deployable: false
      }
    }
  }
  
  // Write test configuration
  writeFileSync('.trunkflowrc.json', JSON.stringify(testConfig, null, 2))
  console.log('✅ Test configuration created')
}

async function generateWorkflows() {
  console.log('🚀 Generating workflows with flowcraft...')
  
  try {
    await runCommand('./flowcraft', ['generate', '--force', '--verbose'])
    console.log('✅ Workflows generated successfully')
  } catch (error) {
    console.error('❌ Failed to generate workflows:', error.message)
    throw error
  }
}

async function testWorkflow(workflowName) {
  console.log(`🧪 Testing workflow: ${workflowName}`)
  
  try {
    // List available workflows
    await runCommand('act', ['--list'])
    
    // Run specific workflow
    await runCommand('act', ['-W', `.github/workflows/${workflowName}`, '--dry-run'])
    console.log(`✅ Workflow ${workflowName} test completed`)
  } catch (error) {
    console.error(`❌ Workflow ${workflowName} test failed:`, error.message)
    throw error
  }
}

async function main() {
  try {
    await setupTestEnvironment()
    await generateWorkflows()
    
    // Test individual workflows
    const workflows = [
      'pipeline.yml',
      'job.changes.yml',
      'job.version.yml',
      'job.tag.yml',
      'job.createpr.yml'
    ]
    
    for (const workflow of workflows) {
      if (existsSync(join('.github/workflows', workflow))) {
        await testWorkflow(workflow)
      } else {
        console.log(`⚠️  Workflow ${workflow} not found, skipping`)
      }
    }
    
    console.log('🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message)
    process.exit(1)
  }
}

// Run the test suite
main()
