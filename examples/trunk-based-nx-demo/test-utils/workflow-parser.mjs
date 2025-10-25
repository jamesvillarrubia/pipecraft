import fs from 'fs/promises'
import yaml from 'yaml'

export async function parseWorkflow(workflowPath) {
  const content = await fs.readFile(workflowPath, 'utf8')
  const doc = yaml.parseDocument(content)
  return { doc, parsed: doc.toJSON() }
}

export function getJobNames(workflow) {
  const jobs = workflow.parsed?.jobs || {}
  return Object.keys(jobs)
}

export function getJob(workflow, jobName) {
  return workflow.parsed?.jobs?.[jobName]
}

export function buildDependencyGraph(workflow) {
  const jobs = workflow.parsed?.jobs || {}
  const graph = {}

  for (const [jobName, jobConfig] of Object.entries(jobs)) {
    const needs = jobConfig.needs || []
    const needsArray = Array.isArray(needs) ? needs : [needs]

    graph[jobName] = {
      needs: needsArray,
      dependents: []
    }
  }

  // Build reverse dependencies
  for (const [jobName, node] of Object.entries(graph)) {
    for (const dependency of node.needs) {
      if (graph[dependency]) {
        graph[dependency].dependents.push(jobName)
      }
    }
  }

  return graph
}

export function findJobsForProject(workflow, projectName) {
  const jobNames = getJobNames(workflow)
  const matchingJobs = []

  for (const jobName of jobNames) {
    if (jobName.includes(projectName)) {
      matchingJobs.push(jobName)
    }
  }

  return matchingJobs
}

export function verifyTestDependsOnBuild(workflow, projectName) {
  const testJob = `test-${projectName}`
  const buildJob = `build-${projectName}`

  const job = getJob(workflow, testJob)

  if (!job) {
    return { exists: false, hasDependency: false }
  }

  const needs = job.needs || []
  const needsArray = Array.isArray(needs) ? needs : [needs]

  return {
    exists: true,
    hasDependency: needsArray.includes(buildJob),
    needs: needsArray
  }
}

export function verifyTestDoesNotDependOnBuild(workflow, projectName) {
  const result = verifyTestDependsOnBuild(workflow, projectName)

  if (!result.exists) {
    return { exists: false, correctlyIndependent: false }
  }

  return {
    exists: true,
    correctlyIndependent: !result.hasDependency,
    needs: result.needs
  }
}

export function validateWorkflow(workflow) {
  const errors = []
  const warnings = []

  const jobNames = getJobNames(workflow)

  if (jobNames.length === 0) {
    errors.push('No jobs found in workflow')
    return { valid: false, errors, warnings }
  }

  const graph = buildDependencyGraph(workflow)

  // Check for circular dependencies
  for (const jobName of jobNames) {
    const visited = new Set()
    const stack = [jobName]

    while (stack.length > 0) {
      const current = stack.pop()

      if (visited.has(current)) {
        errors.push(`Circular dependency detected involving job: ${jobName}`)
        break
      }

      visited.add(current)

      const deps = graph[current]?.needs || []
      stack.push(...deps)
    }
  }

  // Check for missing dependencies
  for (const [jobName, node] of Object.entries(graph)) {
    for (const dependency of node.needs) {
      if (!graph[dependency]) {
        errors.push(`Job "${jobName}" depends on non-existent job "${dependency}"`)
      }
    }
  }

  const valid = errors.length === 0

  return { valid, errors, warnings }
}

export function getJobsByPattern(workflow, pattern) {
  const jobNames = getJobNames(workflow)
  const regex = new RegExp(pattern)

  return jobNames.filter(name => regex.test(name))
}

export function getCustomJobs(workflow) {
  const jobNames = getJobNames(workflow)
  return jobNames.filter(name => name.startsWith('custom-'))
}

export function countJobsByType(workflow) {
  const jobNames = getJobNames(workflow)
  const counts = {
    build: 0,
    test: 0,
    'integration-test': 0,
    deploy: 0,
    custom: 0,
    other: 0
  }

  for (const jobName of jobNames) {
    if (jobName.startsWith('build-')) counts.build++
    else if (jobName.startsWith('test-')) counts.test++
    else if (jobName.startsWith('integration-test-')) counts['integration-test']++
    else if (jobName.startsWith('deploy-')) counts.deploy++
    else if (jobName.startsWith('custom-')) counts.custom++
    else counts.other++
  }

  return counts
}

export async function compareWorkflows(path1, path2) {
  const workflow1 = await parseWorkflow(path1)
  const workflow2 = await parseWorkflow(path2)

  const jobs1 = getJobNames(workflow1)
  const jobs2 = getJobNames(workflow2)

  const addedJobs = jobs2.filter(j => !jobs1.includes(j))
  const removedJobs = jobs1.filter(j => !jobs2.includes(j))
  const commonJobs = jobs1.filter(j => jobs2.includes(j))

  return {
    addedJobs,
    removedJobs,
    commonJobs,
    totalJobs1: jobs1.length,
    totalJobs2: jobs2.length
  }
}
