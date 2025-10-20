/**
 * Test Assertion Helpers
 *
 * Provides custom assertion utilities and matchers for PipeCraft tests.
 * Makes tests more readable and reduces boilerplate for common checks.
 *
 * @module tests/helpers/assertions
 */

import { expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'fs'
import { parse as parseYAML } from 'yaml'

/**
 * Assert that a file exists.
 *
 * More descriptive error message than plain existsSync check.
 *
 * @param filePath - Path to file
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertFileExists('.pipecraftrc.json')
 * assertFileExists('workflow.yml', 'Pipeline workflow should be generated')
 * ```
 */
export function assertFileExists(filePath: string, message?: string): void {
  expect(
    existsSync(filePath),
    message || `Expected file to exist: ${filePath}`
  ).toBe(true)
}

/**
 * Assert that a file does not exist.
 *
 * @param filePath - Path to file
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertFileNotExists('old-file.yml')
 * ```
 */
export function assertFileNotExists(filePath: string, message?: string): void {
  expect(
    existsSync(filePath),
    message || `Expected file not to exist: ${filePath}`
  ).toBe(false)
}

/**
 * Assert that a directory exists.
 *
 * @param dirPath - Path to directory
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertDirectoryExists('.github/workflows')
 * ```
 */
export function assertDirectoryExists(dirPath: string, message?: string): void {
  expect(
    existsSync(dirPath) && statSync(dirPath).isDirectory(),
    message || `Expected directory to exist: ${dirPath}`
  ).toBe(true)
}

/**
 * Assert that file content matches a pattern.
 *
 * @param filePath - Path to file
 * @param pattern - String or RegExp to match
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertFileContains('workflow.yml', 'name: Pipeline')
 * assertFileContains('config.json', /branchFlow.*develop/)
 * ```
 */
export function assertFileContains(
  filePath: string,
  pattern: string | RegExp,
  message?: string
): void {
  assertFileExists(filePath)
  const content = readFileSync(filePath, 'utf-8')

  if (typeof pattern === 'string') {
    expect(
      content,
      message || `Expected file ${filePath} to contain: ${pattern}`
    ).toContain(pattern)
  } else {
    expect(
      content,
      message || `Expected file ${filePath} to match pattern: ${pattern}`
    ).toMatch(pattern)
  }
}

/**
 * Assert that file content does NOT contain a pattern.
 *
 * @param filePath - Path to file
 * @param pattern - String or RegExp that should not match
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertFileNotContains('workflow.yml', 'obsolete-job')
 * ```
 */
export function assertFileNotContains(
  filePath: string,
  pattern: string | RegExp,
  message?: string
): void {
  assertFileExists(filePath)
  const content = readFileSync(filePath, 'utf-8')

  if (typeof pattern === 'string') {
    expect(
      content,
      message || `Expected file ${filePath} not to contain: ${pattern}`
    ).not.toContain(pattern)
  } else {
    expect(
      content,
      message || `Expected file ${filePath} not to match pattern: ${pattern}`
    ).not.toMatch(pattern)
  }
}

/**
 * Assert that YAML file is valid and can be parsed.
 *
 * @param filePath - Path to YAML file
 * @param message - Optional custom error message
 * @returns Parsed YAML object
 *
 * @example
 * ```typescript
 * const workflow = assertValidYAML('workflow.yml')
 * expect(workflow.jobs).toBeDefined()
 * ```
 */
export function assertValidYAML(filePath: string, message?: string): any {
  assertFileExists(filePath)
  const content = readFileSync(filePath, 'utf-8')

  try {
    return parseYAML(content)
  } catch (error: any) {
    throw new Error(
      message || `Expected valid YAML in ${filePath}, but parsing failed: ${error.message}`
    )
  }
}

/**
 * Assert that JSON file is valid and can be parsed.
 *
 * @param filePath - Path to JSON file
 * @param message - Optional custom error message
 * @returns Parsed JSON object
 *
 * @example
 * ```typescript
 * const config = assertValidJSON('.pipecraftrc.json')
 * expect(config.ciProvider).toBe('github')
 * ```
 */
export function assertValidJSON(filePath: string, message?: string): any {
  assertFileExists(filePath)
  const content = readFileSync(filePath, 'utf-8')

  try {
    return JSON.parse(content)
  } catch (error: any) {
    throw new Error(
      message || `Expected valid JSON in ${filePath}, but parsing failed: ${error.message}`
    )
  }
}

/**
 * Assert that a workflow has specific jobs.
 *
 * @param workflowPath - Path to workflow YAML file
 * @param expectedJobs - Array of expected job names
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertWorkflowHasJobs('workflow.yml', ['test', 'build', 'deploy'])
 * ```
 */
export function assertWorkflowHasJobs(
  workflowPath: string,
  expectedJobs: string[],
  message?: string
): void {
  const workflow = assertValidYAML(workflowPath)

  expect(
    workflow.jobs,
    message || `Expected workflow to have jobs object`
  ).toBeDefined()

  const actualJobs = Object.keys(workflow.jobs || {})

  for (const expectedJob of expectedJobs) {
    expect(
      actualJobs,
      message || `Expected workflow to have job: ${expectedJob}`
    ).toContain(expectedJob)
  }
}

/**
 * Assert that a workflow job has specific steps.
 *
 * @param workflowPath - Path to workflow YAML file
 * @param jobName - Name of the job to check
 * @param expectedSteps - Array of expected step names (partial matches)
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertWorkflowJobHasSteps('workflow.yml', 'test', ['checkout', 'install', 'test'])
 * ```
 */
export function assertWorkflowJobHasSteps(
  workflowPath: string,
  jobName: string,
  expectedSteps: string[],
  message?: string
): void {
  const workflow = assertValidYAML(workflowPath)

  expect(
    workflow.jobs?.[jobName],
    `Expected workflow to have job: ${jobName}`
  ).toBeDefined()

  const job = workflow.jobs[jobName]
  expect(
    job.steps,
    `Expected job ${jobName} to have steps array`
  ).toBeDefined()

  const stepNames = job.steps.map((step: any) => step.name || step.uses || '').join('\n')

  for (const expectedStep of expectedSteps) {
    expect(
      stepNames.toLowerCase(),
      message || `Expected job ${jobName} to have step matching: ${expectedStep}`
    ).toContain(expectedStep.toLowerCase())
  }
}

/**
 * Assert that jobs are in correct order.
 *
 * Checks that jobs appear in the expected order in the workflow file.
 *
 * @param workflowPath - Path to workflow YAML file
 * @param expectedOrder - Array of job names in expected order
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertJobOrder('workflow.yml', ['test', 'build', 'deploy'])
 * ```
 */
export function assertJobOrder(
  workflowPath: string,
  expectedOrder: string[],
  message?: string
): void {
  const workflow = assertValidYAML(workflowPath)

  expect(
    workflow.jobs,
    'Expected workflow to have jobs object'
  ).toBeDefined()

  const actualOrder = Object.keys(workflow.jobs || {})

  // Check that expected jobs appear in order (may have other jobs between them)
  let lastIndex = -1
  for (const expectedJob of expectedOrder) {
    const currentIndex = actualOrder.indexOf(expectedJob)

    expect(
      currentIndex,
      message || `Expected to find job ${expectedJob} in workflow`
    ).toBeGreaterThan(-1)

    expect(
      currentIndex,
      message || `Expected job ${expectedJob} to come after previous job`
    ).toBeGreaterThan(lastIndex)

    lastIndex = currentIndex
  }
}

/**
 * Assert that configuration is valid.
 *
 * Checks that config has all required fields.
 *
 * @param config - Configuration object to validate
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertValidConfig(config)
 * ```
 */
export function assertValidConfig(config: any, message?: string): void {
  const requiredFields = [
    'ciProvider',
    'mergeStrategy',
    'initialBranch',
    'finalBranch',
    'branchFlow',
    'domains'
  ]

  for (const field of requiredFields) {
    expect(
      config[field],
      message || `Expected config to have required field: ${field}`
    ).toBeDefined()
  }

  // Validate domains is not empty
  expect(
    Object.keys(config.domains || {}).length,
    message || 'Expected config to have at least one domain'
  ).toBeGreaterThan(0)

  // Validate branch flow is not empty
  expect(
    (config.branchFlow || []).length,
    message || 'Expected config to have at least one branch in flow'
  ).toBeGreaterThan(0)
}

/**
 * Assert that two arrays have the same elements (order independent).
 *
 * @param actual - Actual array
 * @param expected - Expected array
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertArraysEqual(['a', 'b', 'c'], ['c', 'b', 'a'])
 * ```
 */
export function assertArraysEqual<T>(
  actual: T[],
  expected: T[],
  message?: string
): void {
  expect(
    actual.length,
    message || `Expected arrays to have same length`
  ).toBe(expected.length)

  const sortedActual = [...actual].sort()
  const sortedExpected = [...expected].sort()

  expect(
    sortedActual,
    message || `Expected arrays to contain same elements`
  ).toEqual(sortedExpected)
}

/**
 * Assert that string is valid semver version.
 *
 * @param version - Version string to validate
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * assertValidSemver('1.2.3')
 * assertValidSemver('v2.0.0-beta.1')
 * ```
 */
export function assertValidSemver(version: string, message?: string): void {
  const semverRegex = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

  expect(
    version,
    message || `Expected valid semver version, got: ${version}`
  ).toMatch(semverRegex)
}

/**
 * Assert that error has specific message or pattern.
 *
 * @param error - Error object
 * @param pattern - String or RegExp to match error message
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * try {
 *   validateConfig(invalidConfig)
 * } catch (error) {
 *   assertErrorMessage(error, /invalid configuration/i)
 * }
 * ```
 */
export function assertErrorMessage(
  error: any,
  pattern: string | RegExp,
  message?: string
): void {
  expect(
    error,
    'Expected error object to be defined'
  ).toBeDefined()

  expect(
    error.message,
    'Expected error to have message property'
  ).toBeDefined()

  if (typeof pattern === 'string') {
    expect(
      error.message,
      message || `Expected error message to contain: ${pattern}`
    ).toContain(pattern)
  } else {
    expect(
      error.message,
      message || `Expected error message to match pattern: ${pattern}`
    ).toMatch(pattern)
  }
}

