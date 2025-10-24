/**
 * NX Workspace Analyzer
 *
 * Discovers NX project task targets and categorizes them for CI/CD pipeline generation.
 * This module enables intelligent job generation for NX monorepos by:
 *
 * 1. Detecting NX workspace presence
 * 2. Discovering all unique task targets across projects
 * 3. Categorizing tasks as pre-version or post-version
 * 4. Providing task information for workflow generation
 *
 * @module utils/nx-analyzer
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { logger } from './logger.js'

/**
 * Represents a discovered NX task with metadata
 */
export interface NxTask {
  /** Task name (e.g., 'lint', 'test', 'build') */
  name: string
  /** Stage where task should run */
  stage: 'pre-version' | 'post-version'
  /** Optional description from nx.json */
  description?: string
}

/**
 * NX workspace analysis results
 */
export interface NxWorkspaceInfo {
  /** Whether NX is present in the workspace */
  isNxWorkspace: boolean
  /** All discovered task targets */
  tasks: NxTask[]
  /** Tasks categorized by stage */
  tasksByStage: {
    'pre-version': string[]
    'post-version': string[]
  }
}

/**
 * Default task stage mapping
 * Pre-version: Quality checks and builds (don't need version number)
 * Post-version: Deployments and publishing (need version number)
 */
export const DEFAULT_TASK_STAGE_MAPPING: Record<string, 'pre-version' | 'post-version'> = {
  // Pre-version: Quality checks, tests, and builds that don't need version info
  'lint': 'pre-version',
  'test': 'pre-version',
  'unit-test': 'pre-version',
  'e2e': 'pre-version',
  'e2e-ci': 'pre-version',
  'integration-test': 'pre-version',
  'typecheck': 'pre-version',
  'format-check': 'pre-version',
  'validate': 'pre-version',
  'check': 'pre-version',
  'build': 'pre-version',

  // Post-version: Deployments and publishing that need the version number
  'deploy': 'post-version',
  'publish': 'post-version',
  'docker-build': 'post-version',
  'docker': 'post-version',
  'docker-push': 'post-version',
  'package': 'post-version',
  'release': 'post-version',

  // These should typically be excluded as they're not CI tasks
  'serve': 'pre-version',
  'preview': 'pre-version'
}

/**
 * Checks if the current directory is an NX workspace
 */
export function isNxWorkspace(cwd: string = process.cwd()): boolean {
  const nxJsonPath = join(cwd, 'nx.json')
  return existsSync(nxJsonPath)
}

/**
 * Parse nx.json to extract target defaults
 */
function parseNxJson(cwd: string): string[] {
  const nxJsonPath = join(cwd, 'nx.json')

  if (!existsSync(nxJsonPath)) {
    return []
  }

  try {
    const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'))
    const targetDefaults = nxJson.targetDefaults || {}

    return Object.keys(targetDefaults)
  } catch (error) {
    logger.warn(`Failed to parse nx.json: ${error}`)
    return []
  }
}

/**
 * Recursively find all project.json files
 */
function findProjectJsonFiles(dir: string, maxDepth: number = 5, currentDepth: number = 0): string[] {
  if (currentDepth >= maxDepth) {
    return []
  }

  const projectJsonFiles: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      // Skip common directories that won't contain NX projects
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'build') {
        continue
      }

      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Check if this directory has a project.json
        const projectJsonPath = join(fullPath, 'project.json')
        if (existsSync(projectJsonPath)) {
          projectJsonFiles.push(projectJsonPath)
        }

        // Recurse into subdirectories
        projectJsonFiles.push(...findProjectJsonFiles(fullPath, maxDepth, currentDepth + 1))
      }
    }
  } catch (error) {
    logger.debug(`Error reading directory ${dir}: ${error}`)
  }

  return projectJsonFiles
}

/**
 * Parse all project.json files to extract task targets
 */
function parseProjectJsonFiles(cwd: string): string[] {
  const projectJsonFiles = findProjectJsonFiles(cwd)
  const tasks = new Set<string>()

  for (const projectJsonPath of projectJsonFiles) {
    try {
      const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'))
      const targets = projectJson.targets || {}

      Object.keys(targets).forEach(target => tasks.add(target))
    } catch (error) {
      logger.debug(`Failed to parse ${projectJsonPath}: ${error}`)
    }
  }

  return Array.from(tasks)
}

/**
 * Analyze NX workspace and discover all task targets
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @param customMapping - Custom task-to-stage mapping (overrides defaults)
 * @param excludeTasks - Tasks to exclude from discovery
 * @returns NX workspace analysis results
 *
 * @example
 * ```typescript
 * const analysis = analyzeNxWorkspace('/path/to/monorepo')
 *
 * if (analysis.isNxWorkspace) {
 *   console.log('Pre-version tasks:', analysis.tasksByStage['pre-version'])
 *   console.log('Post-version tasks:', analysis.tasksByStage['post-version'])
 * }
 * ```
 */
export function analyzeNxWorkspace(
  cwd: string = process.cwd(),
  customMapping: Record<string, 'pre-version' | 'post-version'> = {},
  excludeTasks: string[] = []
): NxWorkspaceInfo {
  // Check if NX workspace exists
  if (!isNxWorkspace(cwd)) {
    logger.debug('Not an NX workspace')
    return {
      isNxWorkspace: false,
      tasks: [],
      tasksByStage: {
        'pre-version': [],
        'post-version': []
      }
    }
  }

  logger.verbose('📦 Analyzing NX workspace...')

  // Combine task sources
  const nxJsonTasks = parseNxJson(cwd)
  const projectJsonTasks = parseProjectJsonFiles(cwd)
  const allTaskNames = Array.from(new Set([...nxJsonTasks, ...projectJsonTasks]))

  logger.debug(`Found ${allTaskNames.length} unique NX tasks: ${allTaskNames.join(', ')}`)

  // Filter out excluded tasks
  const filteredTaskNames = allTaskNames.filter(task => !excludeTasks.includes(task))

  // Merge custom mapping with defaults
  const stageMapping = { ...DEFAULT_TASK_STAGE_MAPPING, ...customMapping }

  // Categorize tasks
  const tasks: NxTask[] = filteredTaskNames.map(name => {
    const stage = stageMapping[name] || 'pre-version' // Default to pre-version if unknown
    return { name, stage }
  })

  // Group by stage
  const tasksByStage = {
    'pre-version': tasks.filter(t => t.stage === 'pre-version').map(t => t.name),
    'post-version': tasks.filter(t => t.stage === 'post-version').map(t => t.name)
  }

  logger.verbose(`✅ NX analysis complete:`)
  logger.verbose(`   Pre-version tasks: ${tasksByStage['pre-version'].join(', ') || 'none'}`)
  logger.verbose(`   Post-version tasks: ${tasksByStage['post-version'].join(', ') || 'none'}`)

  return {
    isNxWorkspace: true,
    tasks,
    tasksByStage
  }
}

/**
 * Generate nx affected command for a given task
 *
 * @param task - Task name (e.g., 'lint', 'test', 'build')
 * @param base - Base reference for comparison (e.g., 'main')
 * @param useAffected - Whether to use affected or run-many (default: true)
 * @returns Command string
 *
 * @example
 * ```typescript
 * const cmd = generateNxCommand('test', 'main')
 * // Returns: "npx nx affected --target=test --base=main"
 * ```
 */
export function generateNxCommand(
  task: string,
  base: string = 'main',
  useAffected: boolean = true
): string {
  if (useAffected) {
    return `npx nx affected --target=${task} --base=${base}`
  } else {
    return `npx nx run-many --target=${task} --all`
  }
}
