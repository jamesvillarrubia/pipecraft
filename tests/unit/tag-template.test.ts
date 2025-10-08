import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { TEST_DIR } from '../setup'

// Import the template function directly
import { generate } from '../../src/templates/job._tag.yml.tpl'

describe('Tag Template Generation', () => {
  beforeEach(() => {
    // Clean up test directory
    const testFiles = ['.trunkflowrc.json', '.github/workflows/job._tag.yml']
    testFiles.forEach(file => {
      if (existsSync(join(TEST_DIR, file))) {
        rmSync(join(TEST_DIR, file), { recursive: true, force: true })
      }
    })
  })

  afterEach(() => {
    // Clean up generated files
    if (existsSync(join(TEST_DIR, '.github'))) {
      rmSync(join(TEST_DIR, '.github'), { recursive: true, force: true })
    }
  })

  it('should generate tag workflow with default values', async () => {
    const config = {
      initialBranch: 'develop',
      ciProvider: 'github'
    }

    // Run the template generator directly
    await generate({
      cwd: TEST_DIR,
      argv: process.argv,
      pinion: {
        logger: {
          ...console,
          notice: console.log
        },
        prompt: require('inquirer').prompt,
        cwd: TEST_DIR,
        force: true,
        trace: [],
        exec: async (command: string, args: string[]) => {
          const { spawn } = require('child_process')
          return new Promise((resolve, reject) => {
            const child = spawn(command, args, { stdio: 'inherit', shell: true })
            child.once('exit', (code: number) => (code === 0 ? resolve(code) : reject(code)))
          })
        }
      },
      ...config
    })

    // Check that the file was generated
    const generatedFile = join(TEST_DIR, '.github/workflows/job._tag.yml')
    expect(existsSync(generatedFile)).toBe(true)

    // Check the content
    const content = readFileSync(generatedFile, 'utf8')
    console.log('Generated content:', content)
    expect(content).toContain('name: "Tag"')
    expect(content).toContain('workflow_call:')
    expect(content).toContain('inputs:')
    expect(content).toContain('version:')
    expect(content).toContain('github.ref_name == \'develop\'')
    expect(content).toContain('Create Version Tag')
  })

  it('should generate tag workflow with custom initial branch', async () => {
    const config = {
      initialBranch: 'main',
      ciProvider: 'github'
    }

    // Run the template generator directly
    await generate({
      cwd: TEST_DIR,
      argv: process.argv,
      pinion: {
        logger: {
          ...console,
          notice: console.log
        },
        prompt: require('inquirer').prompt,
        cwd: TEST_DIR,
        force: true,
        trace: [],
        exec: async (command: string, args: string[]) => {
          const { spawn } = require('child_process')
          return new Promise((resolve, reject) => {
            const child = spawn(command, args, { stdio: 'inherit', shell: true })
            child.once('exit', (code: number) => (code === 0 ? resolve(code) : reject(code)))
          })
        }
      },
      ...config
    })

    // Check the content
    const generatedFile = join(TEST_DIR, '.github/workflows/job._tag.yml')
    const content = readFileSync(generatedFile, 'utf8')
    expect(content).toContain('github.ref_name == \'main\'')
  })
})