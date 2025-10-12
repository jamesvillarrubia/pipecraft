import { describe, it, expect, beforeEach } from 'vitest'
import { spawn } from 'child_process'
import { writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { TEST_DIR, FIXTURES_DIR } from '../setup'

describe('CLI Integration Tests - Working Commands', () => {
  beforeEach(() => {
    // Clean up any existing files
    const filesToClean = ['.flowcraftrc.json', '.flowcraft-cache.json', 'package.json', '.github']
    filesToClean.forEach(file => {
      const fullPath = join(TEST_DIR, file)
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true })
      }
    })
  })

  describe('generate command', () => {
    beforeEach(() => {
      // Setup test configuration
      const configPath = join(FIXTURES_DIR, 'basic-config.json')
      const configContent = readFileSync(configPath, 'utf8')
      writeFileSync(join(TEST_DIR, '.flowcraftrc.json'), configContent)
    })

    it('should generate workflows successfully', async () => {
      const result = await runCLI(['generate', '--force'])
      
      expect(result.exitCode).toBe(0)
      // Check that .github/workflows directory was created
      expect(existsSync(join(TEST_DIR, '.github/workflows'))).toBe(true)
      // Check that pipeline.yml was created
      expect(existsSync(join(TEST_DIR, '.github/workflows/pipeline.yml'))).toBe(true)
      // Check that actions were created
      expect(existsSync(join(TEST_DIR, '.github/actions'))).toBe(true)
    }, 15000)

    it('should respect dry-run flag', async () => {
      const result = await runCLI(['generate', '--dry-run'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Dry run mode')
    }, 10000)

    it('should respect force flag', async () => {
      // First generation
      await runCLI(['generate', '--force'])
      
      // Second generation with force (should regenerate even though no changes)
      const result = await runCLI(['generate', '--force'])
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated workflows')
    }, 15000)

    it('should handle custom output path', async () => {
      const customPath = join(TEST_DIR, 'custom-pipeline.yml')
      const result = await runCLI(['generate', '--force', '--output-pipeline', customPath])
      
      expect(result.exitCode).toBe(0)
      expect(existsSync(customPath)).toBe(true)
    }, 15000)
  })

  describe('help command', () => {
    it('should show help for generate command', async () => {
      const result = await runCLI(['generate', '--help'])
      
      if (result.exitCode !== 0) {
        console.log('Help command failed')
        console.log('stdout:', result.stdout)
        console.log('stderr:', result.stderr)
      }
      
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generate CI/CD workflows')
    }, 10000)
  })
})

// Helper function to run CLI commands
async function runCLI(args: string[]): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  return new Promise((resolve) => {
    // Use tsx to run TypeScript CLI directly (without --import flag)
    const cliPath = join(process.cwd(), 'src/cli/index.ts')
    const child = spawn('npx', ['tsx', cliPath, ...args], {
      cwd: TEST_DIR,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      })
    })
  })
}

