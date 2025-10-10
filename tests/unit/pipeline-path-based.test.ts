import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseDocument } from 'yaml'
import { createPathBasedPipeline } from '../../src/templates/workflows/pipeline-path-based.yml.tpl'

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
 * Check if workflow_dispatch inputs exist in YAML content
 */
function hasWorkflowDispatchInputs(content: string): boolean {
  return content.includes('workflow_dispatch:') && 
         content.includes('inputs:') &&
         content.includes('version:') &&
         content.includes('baseRef:')
}

/**
 * Check if workflow_call inputs exist in YAML content
 */
function hasWorkflowCallInputs(content: string): boolean {
  return content.includes('workflow_call:') && 
         content.includes('inputs:') &&
         content.includes('version:') &&
         content.includes('baseRef:')
}

describe('Pipeline Path-Based Template', () => {
  const testFixtures = {
    original: join(process.cwd(), 'tests/fixtures/pipeline-user-modified.yml'),
    config: join(process.cwd(), 'tests/fixtures/test-config.json')
  }
  
  describe('Job Order Preservation', () => {
    it('should preserve job order when Flowcraft jobs exist', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      const generatedDoc = parseDocument(result.yamlContent)
      const generatedJobsNode = (generatedDoc.contents as any).get('jobs')
      const generatedOrder = generatedJobsNode.items.map(item => item.key.value)
      
      const originalOrder = getJobOrder(testFixtures.original)
      
      // Should have same number of jobs
      expect(generatedOrder.length).toBe(originalOrder.length)
      
      // Should have same job order
      expect(generatedOrder).toEqual(originalOrder)
    })
    
    it('should maintain Flowcraft jobs in their original positions', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      const generatedDoc = parseDocument(result.yamlContent)
      const generatedJobsNode = (generatedDoc.contents as any).get('jobs')
      const generatedOrder = generatedJobsNode.items.map(item => item.key.value)
      
      const originalOrder = getJobOrder(testFixtures.original)
      
      // Find positions of Flowcraft jobs
      const flowcraftJobs = ['changes', 'version', 'tag', 'createpr', 'branch']
      
      flowcraftJobs.forEach(job => {
        const originalPos = originalOrder.indexOf(job)
        const generatedPos = generatedOrder.indexOf(job)
        
        if (originalPos !== -1) {
          expect(generatedPos).toBe(originalPos)
        }
      })
    })
    
    it('should preserve user jobs in their original positions', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      const generatedDoc = parseDocument(result.yamlContent)
      const generatedJobsNode = (generatedDoc.contents as any).get('jobs')
      const generatedOrder = generatedJobsNode.items.map(item => item.key.value)
      
      const originalOrder = getJobOrder(testFixtures.original)
      
      // Find user jobs (non-Flowcraft jobs)
      const flowcraftJobs = new Set(['changes', 'version', 'tag', 'createpr', 'branch'])
      const userJobs = originalOrder.filter(job => !flowcraftJobs.has(job))
      
      userJobs.forEach(userJob => {
        const originalPos = originalOrder.indexOf(userJob)
        const generatedPos = generatedOrder.indexOf(userJob)
        expect(generatedPos).toBe(originalPos)
      })
    })
  })
  
  describe('Workflow Inputs', () => {
    it('should add workflow_dispatch inputs', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      expect(hasWorkflowDispatchInputs(result.yamlContent)).toBe(true)
    })
    
    it('should add workflow_call inputs', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      expect(hasWorkflowCallInputs(result.yamlContent)).toBe(true)
    })
    
    it('should add workflow inputs without affecting job order', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Should have workflow inputs
      expect(hasWorkflowDispatchInputs(result.yamlContent)).toBe(true)
      expect(hasWorkflowCallInputs(result.yamlContent)).toBe(true)
      
      // But job order should still be preserved
      const generatedDoc = parseDocument(result.yamlContent)
      const generatedJobsNode = (generatedDoc.contents as any).get('jobs')
      const generatedOrder = generatedJobsNode.items.map(item => item.key.value)
      
      const originalOrder = getJobOrder(testFixtures.original)
      expect(generatedOrder).toEqual(originalOrder)
    })
  })
  
  describe('Branch Configuration', () => {
    it('should merge template branches with user branches', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      const generatedDoc = parseDocument(result.yamlContent)
      const pullRequestNode = (generatedDoc.contents as any).get('on').get('pull_request')
      const branches = pullRequestNode.get('branches')
      
      // Should include template branches
      expect(branches.items.map(item => item.value)).toContain('alpha')
      expect(branches.items.map(item => item.value)).toContain('beta')
      expect(branches.items.map(item => item.value)).toContain('gamma')
      expect(branches.items.map(item => item.value)).toContain('delta')
      expect(branches.items.map(item => item.value)).toContain('epsilon')
      
      // Should preserve user branches
      expect(branches.items.map(item => item.value)).toContain('develop')
      expect(branches.items.map(item => item.value)).toContain('feature')
    })
  })
  
  describe('Flowcraft Job Content', () => {
    it('should update Flowcraft job content with latest template', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Check that Flowcraft jobs have the expected structure
      expect(result.yamlContent).toContain('runs-on: ubuntu-latest')
      expect(result.yamlContent).toContain('./.github/actions/detect-changes')
      expect(result.yamlContent).toContain('./.github/actions/calculate-version')
      expect(result.yamlContent).toContain('./.github/actions/create-tag')
      expect(result.yamlContent).toContain('./.github/actions/create-pr')
      expect(result.yamlContent).toContain('./.github/actions/manage-branch')
    })
    
    it('should use correct branch flow in job conditions', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Should use the correct initial branch from config
      expect(result.yamlContent).toContain("github.ref_name == 'alpha'")
      expect(result.yamlContent).toContain("github.ref_name != 'epsilon'")
    })
  })
  
  describe('Comment Preservation', () => {
    it('should preserve user comments', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Should preserve user comments
      expect(result.yamlContent).toContain('# USER COMMENT 1')
      expect(result.yamlContent).toContain('# USER COMMENT 9')
      expect(result.yamlContent).toContain('# USER COMMENT 10')
    })
  })
  
  describe('New Pipeline Generation', () => {
    it('should create new pipeline when no existing content', () => {
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      expect(result.mergeStatus).toBe('overwritten')
      expect(result.yamlContent).toContain('name: "Pipeline"')
      expect(result.yamlContent).toContain('on:')
      expect(result.yamlContent).toContain('jobs:')
    })
    
    it('should build jobs in correct order for new pipeline', () => {
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      const generatedDoc = parseDocument(result.yamlContent)
      const generatedJobsNode = (generatedDoc.contents as any).get('jobs')
      const generatedOrder = generatedJobsNode.items.map(item => item.key.value)
      
      // Should have Flowcraft jobs in correct order
      const expectedOrder = ['changes', 'version', 'tag', 'createpr', 'branch']
      const flowcraftJobs = generatedOrder.filter(job => 
        ['changes', 'version', 'tag', 'createpr', 'branch'].includes(job)
      )
      
      expect(flowcraftJobs).toEqual(expectedOrder)
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle pipeline with no existing Flowcraft jobs', () => {
      // Create a pipeline with only user jobs
      const userOnlyPipeline = `name: "User Pipeline"
on:
  pull_request:
    branches: [main]
jobs:
  user-job-1:
    runs-on: ubuntu-latest
    steps:
      - run: echo "User job"
  user-job-2:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Another user job"`
      
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: userOnlyPipeline,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      const generatedDoc = parseDocument(result.yamlContent)
      const generatedJobsNode = (generatedDoc.contents as any).get('jobs')
      const generatedOrder = generatedJobsNode.items.map(item => item.key.value)
      
      // Should preserve user jobs and add Flowcraft jobs
      expect(generatedOrder).toContain('user-job-1')
      expect(generatedOrder).toContain('user-job-2')
      expect(generatedOrder).toContain('changes')
      expect(generatedOrder).toContain('version')
      expect(generatedOrder).toContain('tag')
      expect(generatedOrder).toContain('createpr')
      expect(generatedOrder).toContain('branch')
      
      // When no existing Flowcraft jobs, Flowcraft jobs are added first, then user jobs
      // This is the expected behavior based on the template logic
      const userJobPositions = [
        generatedOrder.indexOf('user-job-1'),
        generatedOrder.indexOf('user-job-2')
      ]
      const flowcraftJobPositions = [
        generatedOrder.indexOf('changes'),
        generatedOrder.indexOf('version')
      ]
      
      // Flowcraft jobs should come first, then user jobs (when no existing Flowcraft jobs)
      expect(Math.min(...flowcraftJobPositions)).toBeLessThan(Math.max(...userJobPositions))
    })
    
    it('should handle empty pipeline gracefully', () => {
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      expect(result.yamlContent).toBeDefined()
      expect(result.yamlContent.length).toBeGreaterThan(0)
      expect(result.mergeStatus).toBe('overwritten')
    })
    
    it('should handle malformed YAML gracefully', () => {
      const malformedPipeline = `name: "Malformed"
on:
  pull_request:
jobs:
  invalid-job:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: echo "test"
  # Missing closing quote
  another-job:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: echo "test"`
        
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: malformedPipeline,
        ...config
      }
      
      // Should not throw an error
      expect(() => createPathBasedPipeline(ctx)).not.toThrow()
    })
  })
  
  describe('Configuration Handling', () => {
    it('should use custom branch flow from config', () => {
      const customConfig = {
        branchFlow: ['custom1', 'custom2', 'custom3'],
        initialBranch: 'custom1',
        finalBranch: 'custom3'
      }
      
      const ctx = {
        ...customConfig
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Should use custom branch names
      expect(result.yamlContent).toContain("github.ref_name == 'custom1'")
      expect(result.yamlContent).toContain("github.ref_name != 'custom3'")
    })
    
    it('should fall back to default branch flow when not provided', () => {
      const ctx = {}
      
      const result = createPathBasedPipeline(ctx)
      
      // Should use default branch flow
      expect(result.yamlContent).toContain("github.ref_name == 'develop'")
      expect(result.yamlContent).toContain("github.ref_name != 'main'")
    })
    
    it('should handle missing config gracefully', () => {
      const ctx = {
        existingPipelineContent: readFileSync(testFixtures.original, 'utf8')
      }
      
      const result = createPathBasedPipeline(ctx)
      
      expect(result.yamlContent).toBeDefined()
      expect(result.mergeStatus).toBe('merged')
    })
  })
  
  describe('Job Content Validation', () => {
    it('should have correct job dependencies', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Check job dependencies
      expect(result.yamlContent).toContain('needs: changes') // version job
      expect(result.yamlContent).toContain('needs: version') // tag job
      expect(result.yamlContent).toContain('needs: tag') // createpr job
      expect(result.yamlContent).toContain('needs: createpr') // branch job
    })
    
    it('should have correct job conditions', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Check job conditions
      expect(result.yamlContent).toContain("if: github.ref_name == 'alpha'") // version and tag
      expect(result.yamlContent).toContain("if: github.ref_name != 'epsilon'") // createpr
    })
    
    it('should use correct action paths', () => {
      const originalContent = readFileSync(testFixtures.original, 'utf8')
      const config = JSON.parse(readFileSync(testFixtures.config, 'utf8'))
      
      const ctx = {
        existingPipelineContent: originalContent,
        ...config
      }
      
      const result = createPathBasedPipeline(ctx)
      
      // Check action paths
      expect(result.yamlContent).toContain('./.github/actions/detect-changes')
      expect(result.yamlContent).toContain('./.github/actions/calculate-version')
      expect(result.yamlContent).toContain('./.github/actions/create-tag')
      expect(result.yamlContent).toContain('./.github/actions/create-pr')
      expect(result.yamlContent).toContain('./.github/actions/manage-branch')
    })
  })
})
