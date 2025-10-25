import fs from 'fs/promises'
import yaml from 'yaml'

export async function injectCustomJobs(pipelinePath) {
  console.log('💉 Injecting custom jobs into pipeline...')

  const content = await fs.readFile(pipelinePath, 'utf8')
  const doc = yaml.parseDocument(content)

  const customJobs = [
    {
      name: 'custom-security-scan',
      config: {
        'runs-on': 'ubuntu-latest',
        needs: ['detect-changes'],
        steps: [
          {
            name: 'Checkout code',
            uses: 'actions/checkout@v4'
          },
          {
            name: 'Run security audit',
            run: 'npm audit --audit-level=moderate'
          },
          {
            name: 'Run SAST scan',
            run: 'echo "Running static analysis security testing..."'
          }
        ]
      }
    },
    {
      name: 'custom-notification',
      config: {
        'runs-on': 'ubuntu-latest',
        needs: ['detect-changes'],
        if: 'always()',
        steps: [
          {
            name: 'Send Slack notification',
            run: 'echo "Would send Slack notification here..."'
          },
          {
            name: 'Update status page',
            run: 'echo "Would update status page here..."'
          }
        ]
      }
    },
    {
      name: 'custom-integration-test',
      config: {
        'runs-on': 'ubuntu-latest',
        needs: ['detect-changes'],
        steps: [
          {
            name: 'Setup test environment',
            run: 'echo "Setting up integration test environment..."'
          },
          {
            name: 'Run integration tests',
            run: 'echo "Running custom integration tests..."'
          },
          {
            name: 'Cleanup',
            if: 'always()',
            run: 'echo "Cleaning up test environment..."'
          }
        ]
      }
    }
  ]

  // Inject jobs into the document
  for (const { name, config } of customJobs) {
    const jobNode = doc.createNode(config)
    doc.setIn(['jobs', name], jobNode)
    console.log(`  ✅ Injected custom job: ${name}`)
  }

  await fs.writeFile(pipelinePath, doc.toString())

  console.log(`✅ Injected ${customJobs.length} custom jobs`)

  return {
    customJobs: customJobs.map(j => j.name),
    count: customJobs.length
  }
}

export async function verifyJobsPreserved(pipelinePath, expectedJobs) {
  console.log('🔍 Verifying custom jobs were preserved...')

  const content = await fs.readFile(pipelinePath, 'utf8')
  const doc = yaml.parseDocument(content)
  const parsed = doc.toJSON()

  const jobs = parsed?.jobs || {}
  const actualJobs = Object.keys(jobs)

  const results = {
    preserved: [],
    missing: [],
    allPreserved: true
  }

  for (const expectedJob of expectedJobs) {
    if (actualJobs.includes(expectedJob)) {
      results.preserved.push(expectedJob)
      console.log(`  ✅ Job preserved: ${expectedJob}`)
    } else {
      results.missing.push(expectedJob)
      results.allPreserved = false
      console.log(`  ❌ Job missing: ${expectedJob}`)
    }
  }

  if (results.allPreserved) {
    console.log('✅ All custom jobs preserved')
  } else {
    console.log('❌ Some custom jobs were lost during regeneration')
  }

  return results
}

export async function compareWorkflows(path1, path2) {
  console.log('📊 Comparing workflows...')

  const content1 = await fs.readFile(path1, 'utf8')
  const content2 = await fs.readFile(path2, 'utf8')

  const doc1 = yaml.parseDocument(content1)
  const doc2 = yaml.parseDocument(content2)

  const parsed1 = doc1.toJSON()
  const parsed2 = doc2.toJSON()

  const jobs1 = Object.keys(parsed1?.jobs || {})
  const jobs2 = Object.keys(parsed2?.jobs || {})

  const addedJobs = jobs2.filter(j => !jobs1.includes(j))
  const removedJobs = jobs1.filter(j => !jobs2.includes(j))
  const commonJobs = jobs1.filter(j => jobs2.includes(j))

  console.log(`  Added jobs: ${addedJobs.length}`)
  console.log(`  Removed jobs: ${removedJobs.length}`)
  console.log(`  Common jobs: ${commonJobs.length}`)

  return {
    addedJobs,
    removedJobs,
    commonJobs,
    totalJobs1: jobs1.length,
    totalJobs2: jobs2.length
  }
}

export async function extractCustomJobContent(pipelinePath, jobName) {
  const content = await fs.readFile(pipelinePath, 'utf8')
  const doc = yaml.parseDocument(content)
  const parsed = doc.toJSON()

  const job = parsed?.jobs?.[jobName]

  if (!job) {
    return null
  }

  return {
    exists: true,
    jobName,
    config: job
  }
}

export async function validateCustomJobStructure(pipelinePath, jobName, expectedStructure) {
  const jobContent = await extractCustomJobContent(pipelinePath, jobName)

  if (!jobContent) {
    return {
      valid: false,
      error: `Job ${jobName} not found`
    }
  }

  const errors = []

  if (expectedStructure.runsOn && jobContent.config['runs-on'] !== expectedStructure.runsOn) {
    errors.push(`Expected runs-on: ${expectedStructure.runsOn}, got: ${jobContent.config['runs-on']}`)
  }

  if (expectedStructure.needs) {
    const actualNeeds = jobContent.config.needs || []
    const needsArray = Array.isArray(actualNeeds) ? actualNeeds : [actualNeeds]

    for (const need of expectedStructure.needs) {
      if (!needsArray.includes(need)) {
        errors.push(`Expected needs to include: ${need}`)
      }
    }
  }

  if (expectedStructure.stepCount) {
    const actualStepCount = jobContent.config.steps?.length || 0
    if (actualStepCount !== expectedStructure.stepCount) {
      errors.push(`Expected ${expectedStructure.stepCount} steps, got: ${actualStepCount}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
