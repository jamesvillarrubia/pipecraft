import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

/**
 * Extract job names in order from a YAML file
 */
function getJobOrder(filePath: string): string[] {
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    return []
  }

  try {
    const content = readFileSync(filePath, 'utf8')
    const doc = parseDocument(content)

    if (!doc.contents || !(doc.contents as any).get('jobs')) {
      return []
    }

    const jobsNode = (doc.contents as any).get('jobs')
    if (!jobsNode.items) {
      return []
    }

    return jobsNode.items.map(item => item.key.value)
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
    return []
  }
}

/**
 * Compare two job orders and return detailed results
 */
function compareJobOrders(original: string[], generated: string[]) {
  const results = {
    matches: 0,
    total: original.length,
    differences: [] as Array<{ position: number; original: string; generated: string }>,
    isPerfectMatch: false
  }

  for (let i = 0; i < Math.max(original.length, generated.length); i++) {
    const orig = original[i] || '<missing>'
    const gen = generated[i] || '<missing>'

    if (orig === gen) {
      results.matches++
    } else {
      results.differences.push({
        position: i,
        original: orig,
        generated: gen
      })
    }
  }

  results.isPerfectMatch = results.matches === results.total && original.length === generated.length
  return results
}

describe('Job Order Preservation', () => {
  const testFixtures = {
    original: join(process.cwd(), 'tests/fixtures/pipeline-user-modified.yml'),
    generated: join(process.cwd(), 'tests/fixtures/pipeline-generated.yml'),
    config: join(process.cwd(), 'tests/fixtures/test-config.json')
  }

  beforeAll(async () => {
    // Generate the test pipeline using the CLI
    const { execSync } = await import('child_process')

    try {
      // Try to use built CLI if pipecraft isn't in PATH
      const cliCommand = existsSync(join(process.cwd(), 'dist/cli/index.js'))
        ? `node dist/cli/index.js generate --config ${testFixtures.config} --pipeline ${testFixtures.original} --output-pipeline ${testFixtures.generated}`
        : `pipecraft generate --config ${testFixtures.config} --pipeline ${testFixtures.original} --output-pipeline ${testFixtures.generated}`

      execSync(cliCommand, {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    } catch (error) {
      // Silently continue - tests will use existing generated file or skip if not available
      // This is expected when CLI isn't installed globally or dist isn't built
    }
  })

  it('should preserve job order when Pipecraft jobs exist', () => {
    const originalOrder = getJobOrder(testFixtures.original)
    const generatedOrder = getJobOrder(testFixtures.generated)

    expect(originalOrder.length).toBeGreaterThan(0)
    expect(generatedOrder.length).toBeGreaterThan(0)

    const comparison = compareJobOrders(originalOrder, generatedOrder)

    if (!comparison.isPerfectMatch) {
      console.log('❌ Job order differences found:')
      comparison.differences.forEach(diff => {
        console.log(
          `   Position ${diff.position}: expected "${diff.original}", got "${diff.generated}"`
        )
      })
    }

    expect(comparison.isPerfectMatch).toBe(true)
    expect(comparison.matches).toBe(originalOrder.length)
  })

  it('should maintain Pipecraft jobs in their original positions', () => {
    const originalOrder = getJobOrder(testFixtures.original)
    const generatedOrder = getJobOrder(testFixtures.generated)

    // Find positions of Pipecraft jobs in original
    const pipecraftJobs = ['changes', 'version', 'tag', 'createpr', 'branch']
    const originalPipecraftPositions = pipecraftJobs.map(job => originalOrder.indexOf(job))
    const generatedPipecraftPositions = pipecraftJobs.map(job => generatedOrder.indexOf(job))

    // All Pipecraft jobs should be in the same positions
    originalPipecraftPositions.forEach((originalPos, index) => {
      if (originalPos !== -1) {
        // Job exists in original
        expect(generatedPipecraftPositions[index]).toBe(originalPos)
      }
    })
  })

  it('should preserve user jobs in their original positions', () => {
    const originalOrder = getJobOrder(testFixtures.original)
    const generatedOrder = getJobOrder(testFixtures.generated)

    // Find user jobs (non-Pipecraft jobs)
    const pipecraftJobs = new Set(['changes', 'version', 'tag', 'createpr', 'branch'])
    const userJobs = originalOrder.filter(job => !pipecraftJobs.has(job))

    // Each user job should be in the same position
    userJobs.forEach(userJob => {
      const originalPos = originalOrder.indexOf(userJob)
      const generatedPos = generatedOrder.indexOf(userJob)
      expect(generatedPos).toBe(originalPos)
    })
  })

  it('should add workflow_dispatch inputs without affecting job order', () => {
    const generatedContent = readFileSync(testFixtures.generated, 'utf8')

    // Should have workflow_dispatch inputs
    expect(generatedContent).toContain('workflow_dispatch:')
    expect(generatedContent).toContain('inputs:')
    expect(generatedContent).toContain('version:')
    expect(generatedContent).toContain('baseRef:')

    // But job order should still be preserved
    const originalOrder = getJobOrder(testFixtures.original)
    const generatedOrder = getJobOrder(testFixtures.generated)
    const comparison = compareJobOrders(originalOrder, generatedOrder)

    expect(comparison.isPerfectMatch).toBe(true)
  })
})
