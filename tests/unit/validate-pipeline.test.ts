/**
 * Pipeline Validation Script Tests
 *
 * Tests for the validate-pipeline.cjs script that checks workflow files
 * for common issues and best practices.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

describe('Pipeline Validation Script', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(() => {
    // Create unique temp directory for this test
    testDir = join(tmpdir(), `pipecraft-validate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
    originalCwd = process.cwd()
    process.chdir(testDir)

    // Create basic directory structure
    mkdirSync(join(testDir, '.github/workflows'), { recursive: true })
    mkdirSync(join(testDir, '.github/actions/test-action'), { recursive: true })
  })

  afterEach(() => {
    try {
      if (existsSync(originalCwd)) {
        process.chdir(originalCwd)
      } else {
        process.chdir(__dirname)
      }
    } catch (error) {
      process.chdir(__dirname)
    }

    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Valid Workflows', () => {
    it('should pass validation for a well-formed workflow', () => {
      // Create a valid workflow
      const workflow = `
name: Test Workflow
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Test
        run: echo "test"
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      // Create a valid action
      const action = `
name: Test Action
description: Test
runs:
  using: composite
  steps:
    - run: echo "test"
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      // Run validator
      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('✅')
      expect(result).toContain('Pipeline validation passed')
    })
  })

  describe('Git Config Validation', () => {
    it('should detect missing git config in actions with git operations', () => {
      const action = `
name: Tag Action
description: Creates tags
runs:
  using: composite
  steps:
    - run: git tag v1.0.0
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      // Create minimal workflow to avoid other errors
      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      try {
        execSync(
          `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
          { encoding: 'utf8', cwd: testDir, stdio: 'pipe' }
        )
        expect.fail('Should have failed validation')
      } catch (error: any) {
        const output = error.stdout || error.stderr || error.message
        expect(output).toContain('Git operations without git config')
      }
    })

    it('should pass when git config is present', () => {
      const action = `
name: Tag Action
description: Creates tags
runs:
  using: composite
  steps:
    - run: |
        git config user.name github-actions
        git config user.email github-actions@github.com
        git tag v1.0.0
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('✅')
    })
  })

  describe('Checkout Validation', () => {
    it('should detect local action usage before checkout', () => {
      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/test-action
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      // Create action without checkout
      const action = `
name: Test Action
runs:
  using: composite
  steps:
    - run: echo "test"
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      try {
        execSync(
          `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
          { encoding: 'utf8', cwd: testDir, stdio: 'pipe' }
        )
        expect.fail('Should have failed validation')
      } catch (error: any) {
        const output = error.stdout || error.stderr || error.message
        expect(output).toContain('Local action')
        expect(output).toContain('before checkout')
      }
    })

    it('should pass when checkout happens before local action', () => {
      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/test-action
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      const action = `
name: Test Action
runs:
  using: composite
  steps:
    - run: echo "test"
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('✅')
    })

    it('should pass when action has internal checkout', () => {
      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/test-action
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      // Action with internal checkout
      const action = `
name: Test Action
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
    - run: echo "test"
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('✅')
    })
  })

  describe('Error Suppression Detection', () => {
    it('should detect error suppression with 2>/dev/null', () => {
      const action = `
name: PR Action
runs:
  using: composite
  steps:
    - run: gh pr create --title "Test" 2>/dev/null
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('⚠️')
      expect(result).toContain('Suppresses errors')
      expect(result).toContain('gh pr create')
    })
  })

  describe('Version Format Validation', () => {
    it('should warn about version validation without v-prefix stripping', () => {
      const action = `
name: Version Action
inputs:
  version:
    required: true
runs:
  using: composite
  steps:
    - run: |
        if [[ ! "\${{ inputs.version }}" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]; then
          echo "Invalid version format"
          exit 1
        fi
      shell: bash
`
      writeFileSync(join(testDir, '.github/actions/test-action/action.yml'), action)

      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('⚠️')
      expect(result).toContain("doesn't strip 'v' prefix")
    })
  })

  describe('pnpm Order Validation', () => {
    it('should warn about pnpm cache before pnpm install', () => {
      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          cache: 'pnpm'
      - uses: pnpm/action-setup@v3
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('⚠️')
      expect(result).toContain('pnpm cache before pnpm is installed')
    })

    it('should pass when pnpm is installed first', () => {
      const workflow = `
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          cache: 'pnpm'
`
      writeFileSync(join(testDir, '.github/workflows/test.yml'), workflow)

      const result = execSync(
        `node ${join(originalCwd, 'tests/tools/validation/validate-pipeline.cjs')}`,
        { encoding: 'utf8', cwd: testDir }
      )

      expect(result).toContain('✅')
      expect(result).not.toContain('pnpm cache before')
    })
  })
})
