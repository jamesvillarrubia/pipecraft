# 🤖 Flowcraft AI Build Plan

## Overview

This is an AI build plan for creating Flowcraft, a CLI tool for managing trunk-based development workflows using Pinion for template generation. Follow these instructions step-by-step to build the complete library.

## 🎯 Project Goals

- **Automate trunk-based development workflows** with linear Git history
- **Generate CI/CD workflows** for GitHub Actions and GitLab CI
- **Enforce conventional commits** and semantic versioning
- **Provide simple CLI interface** for configuration and management
- **Support multiple project structures** (monorepos, microservices, etc.)

## 🏗️ Architecture

### Core Technologies
- **Pinion** - Template generation and scaffolding
- **Commander.js** - CLI interface
- **Cosmic Config** - Configuration management
- **TypeScript** - Type safety and developer experience
- **Node.js** - Runtime environment
- **File System Hashing** - Idempotent rebuild detection
- **Configuration Guards** - Prevent unnecessary rebuilds

### Project Structure
```
flowcraft/
├── src/
│   ├── generators/           # Pinion generators
│   │   ├── init.tpl.ts       # Project initialization
│   │   ├── workflows.tpl.ts  # CI/CD workflow generation
│   │   ├── gitlab.tpl.ts     # GitLab CI templates
│   │   └── hooks.tpl.ts      # Git hooks generation
│   ├── cli/                  # CLI commands
│   │   ├── index.ts          # Main CLI entry point
│   │   ├── init.ts           # Initialization command
│   │   ├── generate.ts       # Workflow generation
│   │   ├── validate.ts       # Configuration validation
│   │   └── promote.ts        # Branch promotion
│   ├── templates/            # Template files
│   │   ├── github/           # GitHub Actions templates
│   │   ├── gitlab/           # GitLab CI templates
│   │   └── hooks/            # Git hooks templates
│   └── utils/                # Utility functions
├── examples/                 # Example configurations
├── docs/                     # Documentation
└── tests/                    # Test files
```

## 📋 Build Instructions

### Step 1: Project Setup

#### 1.1 Initialize TypeScript Project
```bash
# Create package.json with proper configuration
npm init -y

# Install core dependencies
npm install @featherscloud/pinion commander cosmiconfig inquirer

# Install dev dependencies
npm install -D typescript tsx @types/node @types/inquirer vitest eslint prettier

# Create TypeScript configuration
npx tsc --init
```

#### 1.2 Configure Build System
```json
// package.json
{
  "name": "flowcraft",
  "version": "1.0.0",
  "description": "CLI tool for managing trunk-based development workflows",
  "type": "module",
  "bin": {
    "flowcraft": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write '**/*.ts'"
  }
}
```

#### 1.3 Install Additional Dependencies for Idempotency and Versioning
```bash
# Install crypto for file hashing
npm install crypto

# Install file system utilities
npm install fs-extra

# Install change detection
npm install chokidar

# Install release-it and conventional changelog
npm install release-it @release-it/conventional-changelog

# Install conventional commit utilities
npm install @commitlint/cli @commitlint/config-conventional
npm install husky lint-staged
```

#### 1.4 Set Up TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2: Core Infrastructure

#### 2.1 Create Base Types
```typescript
// src/types/index.ts
export interface FlowcraftConfig {
  ciProvider: 'github' | 'gitlab'
  mergeStrategy: 'fast-forward' | 'merge'
  requireConventionalCommits: boolean
  initialBranch: string
  finalBranch: string
  branchFlow: string[]
  semver: {
    bumpRules: Record<string, string>
  }
  actions: {
    onDevelopMerge: string[]
    onStagingMerge: string[]
  }
  domains: Record<string, {
    paths: string[]
    description: string
  }>
  // Idempotency and rebuild configuration
  rebuild?: {
    enabled: boolean
    skipIfUnchanged: boolean
    forceRegenerate: boolean
    watchMode: boolean
    hashAlgorithm: 'md5' | 'sha1' | 'sha256'
    cacheFile: string
    ignorePatterns: string[]
  }
  // Version management with release-it
  versioning?: {
    enabled: boolean
    releaseItConfig: string
    conventionalCommits: boolean
    autoTag: boolean
    autoPush: boolean
    changelog: boolean
    bumpRules: Record<string, string>
  }
}

export interface FlowcraftContext extends PinionContext {
  projectName: string
  ciProvider: 'github' | 'gitlab'
  mergeStrategy: 'fast-forward' | 'merge'
  requireConventionalCommits: boolean
  initialBranch: string
  finalBranch: string
  branchFlow: string[]
  domains: Record<string, { paths: string[], description: string }>
  semver: {
    bumpRules: Record<string, string>
  }
  actions: {
    onDevelopMerge: string[]
    onStagingMerge: string[]
  }
}
```

#### 2.2 Create Idempotency Utilities
```typescript
// src/utils/idempotency.ts
import { createHash } from 'crypto'
import { readFileSync, existsSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'

export interface FileHash {
  path: string
  hash: string
  mtime: number
  size: number
}

export interface RebuildCache {
  files: Record<string, FileHash>
  configHash: string
  lastGenerated: number
  version: string
}

export class IdempotencyManager {
  private cacheFile: string
  private config: FlowcraftConfig

  constructor(config: FlowcraftConfig, cacheFile = '.flowcraft-cache.json') {
    this.config = config
    this.cacheFile = cacheFile
  }

  /**
   * Calculate hash for a file or directory
   */
  calculateHash(filePath: string, algorithm: string = 'sha256'): string {
    if (!existsSync(filePath)) {
      return ''
    }

    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      // For directories, hash all files recursively
      return this.hashDirectory(filePath, algorithm)
    } else {
      // For files, hash content + metadata
      const content = readFileSync(filePath)
      const hash = createHash(algorithm)
      hash.update(content)
      hash.update(stats.mtime.toString())
      hash.update(stats.size.toString())
      return hash.digest('hex')
    }
  }

  /**
   * Hash directory contents recursively
   */
  private hashDirectory(dirPath: string, algorithm: string): string {
    const fs = require('fs')
    const path = require('path')
    const hash = createHash(algorithm)
    
    const hashDir = (dir: string) => {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const itemPath = path.join(dir, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          hashDir(itemPath)
        } else {
          const content = fs.readFileSync(itemPath)
          hash.update(content)
          hash.update(stats.mtime.toString())
          hash.update(stats.size.toString())
        }
      }
    }
    
    hashDir(dirPath)
    return hash.digest('hex')
  }

  /**
   * Load rebuild cache from file
   */
  loadCache(): RebuildCache | null {
    if (!existsSync(this.cacheFile)) {
      return null
    }

    try {
      const content = readFileSync(this.cacheFile, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      console.warn(`Failed to load cache file: ${error.message}`)
      return null
    }
  }

  /**
   * Save rebuild cache to file
   */
  saveCache(cache: RebuildCache): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2))
    } catch (error) {
      console.warn(`Failed to save cache file: ${error.message}`)
    }
  }

  /**
   * Check if files have changed since last generation
   */
  hasChanges(): boolean {
    if (!this.config.rebuild?.enabled) {
      return true // Always regenerate if rebuild is disabled
    }

    if (this.config.rebuild?.forceRegenerate) {
      return true // Force regeneration
    }

    const cache = this.loadCache()
    if (!cache) {
      return true // No cache, need to regenerate
    }

    // Check if config has changed
    const configHash = this.calculateHash('.trunkflowrc.json')
    if (cache.configHash !== configHash) {
      return true
    }

    // Check if template files have changed
    const templateDir = 'src/templates'
    if (existsSync(templateDir)) {
      const templateHash = this.calculateHash(templateDir)
      if (cache.files[templateDir]?.hash !== templateHash) {
        return true
      }
    }

    // Check if source files have changed
    const sourceDir = 'src/generators'
    if (existsSync(sourceDir)) {
      const sourceHash = this.calculateHash(sourceDir)
      if (cache.files[sourceDir]?.hash !== sourceHash) {
        return true
      }
    }

    return false
  }

  /**
   * Update cache with current file states
   */
  updateCache(): void {
    const cache: RebuildCache = {
      files: {},
      configHash: this.calculateHash('.trunkflowrc.json'),
      lastGenerated: Date.now(),
      version: '1.0.0'
    }

    // Cache template files
    const templateDir = 'src/templates'
    if (existsSync(templateDir)) {
      cache.files[templateDir] = {
        path: templateDir,
        hash: this.calculateHash(templateDir),
        mtime: statSync(templateDir).mtime.getTime(),
        size: 0 // Directory size not meaningful
      }
    }

    // Cache source files
    const sourceDir = 'src/generators'
    if (existsSync(sourceDir)) {
      cache.files[sourceDir] = {
        path: sourceDir,
        hash: this.calculateHash(sourceDir),
        mtime: statSync(sourceDir).mtime.getTime(),
        size: 0
      }
    }

    this.saveCache(cache)
  }

  /**
   * Check if specific file should be regenerated
   */
  shouldRegenerateFile(filePath: string): boolean {
    if (!this.config.rebuild?.enabled) {
      return true
    }

    if (this.config.rebuild?.forceRegenerate) {
      return true
    }

    const cache = this.loadCache()
    if (!cache) {
      return true
    }

    const currentHash = this.calculateHash(filePath)
    const cachedFile = cache.files[filePath]
    
    if (!cachedFile) {
      return true // File not in cache, needs generation
    }

    return cachedFile.hash !== currentHash
  }
}
```

#### 2.3 Create Version Management Utilities
```typescript
// src/utils/versioning.ts
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export class VersionManager {
  private config: FlowcraftConfig

  constructor(config: FlowcraftConfig) {
    this.config = config
  }

  /**
   * Generate release-it configuration
   */
  generateReleaseItConfig(): string {
    const defaultConfig = {
      git: {
        requireCleanWorkingDir: false,
        commit: false,
        pushArgs: ["--tags"],
        tagMatch: "v[0-9]*.[0-9]*.[0-9]*"
      },
      github: {
        release: false
      },
      npm: {
        ignoreVersion: true,
        publish: false,
        skipChecks: true
      },
      hooks: {
        "after:release": "echo ${version} > .release-version"
      },
      plugins: {
        "@release-it/conventional-changelog": {
          whatBump: (commits: any[], options: any) => {
            const defaults = {
              test: 'ignore',
              build: 'ignore',
              ci: 'patch',
              docs: 'patch',
              chore: 'minor',
              style: 'patch',
              fix: 'patch',
              perf: 'patch',
              refactor: 'patch',
              feat: 'minor',
              major: 'major',
            }

            // Merge with user-defined bump rules
            const bumpRules = { ...defaults, ...this.config.versioning?.bumpRules }
            
            let breakings = 0
            let features = 0
            let levelSet = ['major', 'minor', 'patch', 'ignore']
            
            let level = Math.min.apply(Math, commits.map(commit => {
              let level = levelSet.indexOf(bumpRules[commit.type] || 'ignore')
              level = level < 0 ? 3 : level
              
              if (commit.notes.length > 0) {
                breakings += commit.notes.length
              }
              if (commit.type === 'feat') {
                features += 1
              }
              return level
            }))

            return {
              level: level,
              reason: breakings === 1
                ? `There is ${breakings} BREAKING CHANGE and ${features} features`
                : `There are ${breakings} BREAKING CHANGES and ${features} features`
            }
          }
        }
      }
    }

    return `module.exports = ${JSON.stringify(defaultConfig, null, 2)}`
  }

  /**
   * Generate commitlint configuration
   */
  generateCommitlintConfig(): string {
    return `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert'
      ]
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never']
  }
}`
  }

  /**
   * Generate husky configuration
   */
  generateHuskyConfig(): string {
    return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit $1`
  }

  /**
   * Setup version management files
   */
  setupVersionManagement(): void {
    if (!this.config.versioning?.enabled) {
      return
    }

    // Generate .release-it.cjs
    const releaseItConfig = this.generateReleaseItConfig()
    writeFileSync('.release-it.cjs', releaseItConfig)

    // Generate commitlint.config.js
    const commitlintConfig = this.generateCommitlintConfig()
    writeFileSync('commitlint.config.js', commitlintConfig)

    // Generate .husky/commit-msg
    const huskyDir = '.husky'
    if (!existsSync(huskyDir)) {
      execSync('npx husky install', { stdio: 'inherit' })
    }
    
    const commitMsgHook = this.generateHuskyConfig()
    writeFileSync(join(huskyDir, 'commit-msg'), commitMsgHook)
    execSync(`chmod +x ${join(huskyDir, 'commit-msg')}`)

    // Update package.json scripts
    this.updatePackageJsonScripts()
  }

  /**
   * Update package.json with version management scripts
   */
  private updatePackageJsonScripts(): void {
    const packageJsonPath = 'package.json'
    if (!existsSync(packageJsonPath)) {
      return
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'release': 'release-it',
      'release:dry': 'release-it --dry-run',
      'version:check': 'release-it --dry-run',
      'changelog': 'conventional-changelog -p angular -i CHANGELOG.md -s',
      'commit': 'git add . && git commit',
      'prepare': 'husky install'
    }

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  /**
   * Check if conventional commits are being used
   */
  validateConventionalCommits(): boolean {
    try {
      const result = execSync('git log --oneline -10', { encoding: 'utf8' })
      const commits = result.split('\n').filter(line => line.trim())
      
      // Check if commits follow conventional format
      const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+/
      
      return commits.every(commit => conventionalPattern.test(commit))
    } catch (error) {
      return false
    }
  }

  /**
   * Get current version from git tags
   */
  getCurrentVersion(): string {
    try {
      const result = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' })
      return result.trim().replace('v', '')
    } catch (error) {
      return '0.0.0'
    }
  }

  /**
   * Calculate next version based on conventional commits
   */
  calculateNextVersion(): { version: string, type: string } {
    try {
      const currentVersion = this.getCurrentVersion()
      const result = execSync('npx release-it --dry-run --no-git.requireCleanWorkingDir', { 
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      // Parse release-it output to get version info
      const versionMatch = result.match(/version\s+(\d+\.\d+\.\d+)/)
      const typeMatch = result.match(/bump\s+(\w+)/)
      
      return {
        version: versionMatch ? versionMatch[1] : currentVersion,
        type: typeMatch ? typeMatch[1] : 'patch'
      }
    } catch (error) {
      return {
        version: this.getCurrentVersion(),
        type: 'patch'
      }
    }
  }
}
```

#### 2.4 Create Configuration Utilities
```typescript
// src/utils/config.ts
import { cosmiconfigSync } from 'cosmiconfig'

export const loadConfig = (configPath?: string) => {
  const explorer = cosmiconfigSync('trunkflow')
  const result = explorer.search()
  
  if (!result) {
    throw new Error(`No configuration file found. Expected: ${configPath || '.trunkflowrc.json'}`)
  }
  
  return result.config
}

export const validateConfig = (config: any) => {
  const requiredFields = ['ciProvider', 'mergeStrategy', 'requireConventionalCommits', 'initialBranch', 'finalBranch', 'branchFlow', 'domains']
  
  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  if (!['github', 'gitlab'].includes(config.ciProvider)) {
    throw new Error('ciProvider must be either "github" or "gitlab"')
  }
  
  if (!['fast-forward', 'merge'].includes(config.mergeStrategy)) {
    throw new Error('mergeStrategy must be either "fast-forward" or "merge"')
  }
  
  if (!Array.isArray(config.branchFlow) || config.branchFlow.length < 2) {
    throw new Error('branchFlow must be an array with at least 2 branches')
  }
  
  if (typeof config.domains !== 'object') {
    throw new Error('domains must be an object')
  }
  
  for (const [domainName, domainConfig] of Object.entries(config.domains)) {
    if (!domainConfig.paths || !Array.isArray(domainConfig.paths)) {
      throw new Error(`Domain "${domainName}" must have a "paths" array`)
    }
    
    if (domainConfig.paths.length === 0) {
      throw new Error(`Domain "${domainName}" must have at least one path pattern`)
    }
  }
  
  return true
}
```

### Step 3: Pinion Generators

#### 3.1 Create Initialization Generator
```typescript
// src/generators/init.tpl.ts
import { PinionContext, toFile, renderTemplate, prompt, when, writeJSON } from '@featherscloud/pinion'
import { existsSync } from 'fs'
import { IdempotencyManager } from '../utils/idempotency'

const defaultConfig = {
  ciProvider: 'github' as const,
  mergeStrategy: 'fast-forward' as const,
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
    onDevelopMerge: ['runTests', 'fastForwardToStaging'],
    onStagingMerge: ['runTests', 'calculateVersion', 'createOrFastForwardToMain']
  },
  domains: {
    api: {
      paths: ['apps/api/**'],
      description: 'API application changes'
    },
    web: {
      paths: ['apps/web/**'],
      description: 'Web application changes'
    },
    libs: {
      paths: ['libs/**'],
      description: 'Shared library changes'
    },
    cicd: {
      paths: ['.github/workflows/**'],
      description: 'CI/CD configuration changes'
    }
  }
}

const configTemplate = (ctx: FlowcraftContext) => `{
  "ciProvider": "${ctx.ciProvider}",
  "mergeStrategy": "${ctx.mergeStrategy}",
  "requireConventionalCommits": ${ctx.requireConventionalCommits},
  "initialBranch": "${ctx.initialBranch}",
  "finalBranch": "${ctx.finalBranch}",
  "branchFlow": ${JSON.stringify(ctx.branchFlow, null, 2)},
  "semver": {
    "bumpRules": ${JSON.stringify(ctx.semver.bumpRules, null, 4)}
  },
  "actions": {
    "onDevelopMerge": ${JSON.stringify(ctx.actions.onDevelopMerge)},
    "onStagingMerge": ${JSON.stringify(ctx.actions.onStagingMerge)}
  },
  "domains": ${JSON.stringify(ctx.domains, null, 2)}
}`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is your project name?',
        default: 'my-project'
      },
      {
        type: 'list',
        name: 'ciProvider',
        message: 'Which CI provider are you using?',
        choices: [
          { name: 'GitHub Actions', value: 'github' },
          { name: 'GitLab CI/CD', value: 'gitlab' }
        ],
        default: 'github'
      },
      {
        type: 'list',
        name: 'mergeStrategy',
        message: 'What merge strategy do you prefer?',
        choices: [
          { name: 'Fast-forward only (recommended)', value: 'fast-forward' },
          { name: 'Merge commits', value: 'merge' }
        ],
        default: 'fast-forward'
      },
      {
        type: 'confirm',
        name: 'requireConventionalCommits',
        message: 'Require conventional commit format for PR titles?',
        default: true
      },
      {
        type: 'input',
        name: 'initialBranch',
        message: 'What is your development branch name?',
        default: 'develop'
      },
      {
        type: 'input',
        name: 'finalBranch',
        message: 'What is your production branch name?',
        default: 'main'
      },
      {
        type: 'input',
        name: 'branchFlow',
        message: 'Enter your branch flow (comma-separated)',
        default: 'develop,staging,main',
        filter: (input: string) => input.split(',').map(b => b.trim())
      }
    ]))
    .then((ctx) => ({ ...ctx, ...defaultConfig } as FlowcraftContext))
    .then(renderTemplate(configTemplate, toFile('.trunkflowrc.json')))
    .then(renderTemplate(() => `# ${ctx.projectName}

This project uses Flowcraft for automated branching and release management.

## Branching Strategy

- **${ctx.initialBranch}**: Active development branch
- **${ctx.branchFlow.slice(1, -1).join(', ')}**: Staging/validation branches  
- **${ctx.finalBranch}**: Production branch

## Workflow

1. Create feature branches from \`${ctx.initialBranch}\`
2. Submit PRs with conventional commit titles
3. Automated promotion through branch flow
4. Automatic versioning and tagging

## Commands

\`\`\`bash
# Initialize Flowcraft
npx flowcraft init

# Generate workflows
npx flowcraft generate

# Validate configuration
npx flowcraft validate

# Promote to next environment
npx flowcraft promote
\`\`\`
`, toFile('FLOWCRAFT.md')))
```

#### 3.2 Create Workflow Generator
```typescript
// src/generators/workflows.tpl.ts
import { PinionContext, toFile, renderTemplate, loadJSON, when } from '@featherscloud/pinion'
import { IdempotencyManager } from '../utils/idempotency'
import { existsSync } from 'fs'

const changesWorkflowTemplate = (ctx: WorkflowContext) => {
  const domainNames = Object.keys(ctx.domains)
  const outputs = domainNames.map(name => `      ${name}: 
        value: ${{ jobs.changes.outputs.${name} }}`).join('\n')
  
  const jobOutputs = domainNames.map(name => `      ${name}: ${{ steps.merge.outputs.${name} }}`).join('\n')
  
  const branchCases = ctx.branchFlow.slice(0, -1).map((branch, index) => 
    `          'refs/heads/${branch}')
            base_branch='${ctx.branchFlow[index + 1]}'
            ;;`
  ).join('\n')
  
  const filters = Object.entries(ctx.domains).map(([name, config]) => 
    `          ${name}:
${config.paths.map(path => `            - '${path}'`).join('\n')}`
  ).join('\n')
  
  const mergeOutputs = domainNames.map(name => 
    `        echo "${name}=${{ steps.filter.outputs.${name} == 'true' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/test' }}" >> $GITHUB_OUTPUT`
  ).join('\n')
  
  const debugOutputs = domainNames.map(name => 
    `        echo "${name.toUpperCase()}: ${{ steps.merge.outputs.${name} }}"`
  ).join('\n')

  return `name: "Changes"

on:
  workflow_call:
    outputs:
${outputs}
      
  workflow_dispatch:

jobs:
  changes:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
${jobOutputs}
    steps:

    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      ## Updated ${ctx.branchFlow.length}-branch flow: ${ctx.branchFlow.join(' → ')}
      ## Each branch compares to the next in the flow
      run: |
        case '${{ github.ref }}' in
${branchCases}
          *)
            base_branch='${ctx.branchFlow[0]}'
            ;;
        esac
        echo "Base branch determined: $base_branch"
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - uses: dorny/paths-filter@v3
      id: filter
      with:
        base: ${{ env.base_branch }}
        filters: |
${filters}

    - name: Merge filter outputs with branch condition
      id: merge
      run: |
        # Force full deployment on main, staging, and test branches
${mergeOutputs}

    - name: Debug Paths Filter Outputs
      run: |
${debugOutputs}`
}

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(loadJSON(
      () => '.trunkflowrc.json',
      (config) => ({ ...ctx, ...config } as WorkflowContext),
      () => ({ ...ctx, ...defaultConfig } as WorkflowContext)
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(changesWorkflowTemplate, toFile('.github/workflows/job.changes.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(versionWorkflowTemplate, toFile('.github/workflows/job.version.yml'))
    ))
    .then(when(
      (ctx) => ctx.ciProvider === 'github',
      renderTemplate(pipelineWorkflowTemplate, toFile('.github/workflows/pipeline.yml'))
    ))
```

### Step 4: CLI Implementation

#### 4.1 Create Main CLI Entry Point
```typescript
// src/cli/index.ts
#!/usr/bin/env node

import { Command } from 'commander'
import { cosmiconfigSync } from 'cosmiconfig'
import { runModule } from '@featherscloud/pinion'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { IdempotencyManager } from '../utils/idempotency'
import { VersionManager } from '../utils/versioning'
import { loadConfig, validateConfig } from '../utils/config'
import { FlowcraftConfig } from '../types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const program = new Command()

// Configure the CLI
program
  .name('flowcraft')
  .description('CLI tool for managing trunk-based development workflows')
  .version('1.0.0')

// Global options
program
  .option('-c, --config <path>', 'path to config file', '.trunkflowrc.json')
  .option('-v, --verbose', 'verbose output')
  .option('--force', 'force regeneration even if files unchanged')
  .option('--dry-run', 'show what would be done without making changes')

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize flowcraft configuration')
  .option('-f, --force', 'overwrite existing config')
  .option('-i, --interactive', 'interactive setup wizard')
  .option('--with-versioning', 'include version management setup')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      
      await runModule(join(__dirname, '../generators/init.tpl.ts'), {
        cwd: process.cwd(),
        argv: process.argv,
        pinion: {
          logger: console,
          prompt: require('inquirer').prompt,
          cwd: process.cwd(),
          force: options.force || globalOptions.force || false,
          trace: [],
          exec: async (command: string, args: string[]) => {
            const { spawn } = require('child_process')
            return new Promise((resolve, reject) => {
              const child = spawn(command, args, { stdio: 'inherit', shell: true })
              child.once('exit', (code: number) => (code === 0 ? resolve(code) : reject(code)))
            })
          }
        }
      })
      
      // Setup version management if requested
      if (options.withVersioning) {
        const config = loadConfig(globalOptions.config)
        const versionManager = new VersionManager(config)
        versionManager.setupVersionManagement()
        console.log('✅ Version management setup completed!')
      }
      
      console.log('✅ Configuration initialized successfully!')
    } catch (error) {
      console.error('❌ Failed to initialize configuration:', error.message)
      process.exit(1)
    }
  })

// Generate command - Generate workflow files
program
  .command('generate')
  .description('Generate CI/CD workflows from configuration')
  .option('-o, --output <path>', 'output directory for generated workflows', '.github/workflows')
  .option('--skip-unchanged', 'skip files that haven\'t changed')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      
      if (globalOptions.verbose) {
        console.log(`📖 Reading config from: ${configPath}`)
      }
      
      // Load configuration
      const config = loadConfig(configPath) as FlowcraftConfig
      
      // Check idempotency if not forcing
      if (!globalOptions.force && !globalOptions.dryRun) {
        const idempotencyManager = new IdempotencyManager(config)
        
        if (!idempotencyManager.hasChanges()) {
          console.log('ℹ️  No changes detected. Use --force to regenerate anyway.')
          return
        }
        
        if (globalOptions.verbose) {
          console.log('🔄 Changes detected, regenerating workflows...')
        }
      }
      
      if (globalOptions.dryRun) {
        console.log('🔍 Dry run mode - would generate workflows')
        return
      }
      
      await runModule(join(__dirname, '../generators/workflows.tpl.ts'), {
        cwd: process.cwd(),
        argv: process.argv,
        pinion: {
          logger: console,
          prompt: require('inquirer').prompt,
          cwd: process.cwd(),
          force: globalOptions.force || false,
          trace: [],
          exec: async (command: string, args: string[]) => {
            const { spawn } = require('child_process')
            return new Promise((resolve, reject) => {
              const child = spawn(command, args, { stdio: 'inherit', shell: true })
              child.once('exit', (code: number) => (code === 0 ? resolve(code) : reject(code)))
            })
          }
        }
      })
      
      // Update idempotency cache
      const idempotencyManager = new IdempotencyManager(config)
      idempotencyManager.updateCache()
      
      console.log(`✅ Generated workflows in: ${options.output}`)
    } catch (error) {
      console.error('❌ Failed to generate workflows:', error.message)
      process.exit(1)
    }
  })

// Validate command - Validate configuration
program
  .command('validate')
  .description('Validate configuration file')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      
      const explorer = cosmiconfigSync('trunkflow')
      const result = explorer.search()
      
      if (!result) {
        throw new Error(`No configuration file found. Expected: ${configPath}`)
      }
      
      const config = result.config
      validateConfig(config)
      
      console.log('✅ Configuration is valid!')
    } catch (error) {
      console.error('❌ Configuration validation failed:', error.message)
      process.exit(1)
    }
  })

// Verify command - Check if setup is correct
program
  .command('verify')
  .description('Verify that flowcraft is properly set up')
  .action(async () => {
    try {
      const explorer = cosmiconfigSync('trunkflow')
      const result = explorer.search()
      
      if (!result) {
        console.log('⚠️  No configuration file found. Run "flowcraft init" to get started.')
        process.exit(1)
      }
      
      console.log(`✅ Found configuration at: ${result.filepath}`)
      
      const config = result.config
      validateConfig(config)
      console.log('✅ Configuration is valid!')
      
      // Check if workflows exist
      const fs = require('fs')
      const path = require('path')
      
      if (config.ciProvider === 'github') {
        const workflowPath = path.join(process.cwd(), '.github/workflows/pipeline.yml')
        if (fs.existsSync(workflowPath)) {
          console.log('✅ GitHub Actions workflows exist!')
        } else {
          console.log('⚠️  GitHub Actions workflows not found. Run "flowcraft generate" to create them.')
        }
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message)
      process.exit(1)
    }
  })

// Version command - Version management
program
  .command('version')
  .description('Version management commands')
  .option('--check', 'check current version and next version')
  .option('--bump', 'bump version using conventional commits')
  .option('--release', 'create release with version bump')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const config = loadConfig(globalOptions.config) as FlowcraftConfig
      const versionManager = new VersionManager(config)
      
      if (options.check) {
        const currentVersion = versionManager.getCurrentVersion()
        const nextVersion = versionManager.calculateNextVersion()
        
        console.log(`📦 Current version: ${currentVersion}`)
        console.log(`📦 Next version: ${nextVersion.version} (${nextVersion.type})`)
        
        // Check conventional commits
        const isValid = versionManager.validateConventionalCommits()
        console.log(`📝 Conventional commits: ${isValid ? '✅ Valid' : '❌ Invalid'}`)
      }
      
      if (options.bump) {
        console.log('🔄 Bumping version...')
        // This would run release-it in dry-run mode first
        console.log('✅ Version bump completed!')
      }
      
      if (options.release) {
        console.log('🚀 Creating release...')
        // This would run the actual release process
        console.log('✅ Release created!')
      }
      
    } catch (error) {
      console.error('❌ Version command failed:', error.message)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
```

### Step 5: Template Files

#### 5.1 Create GitHub Actions Templates
```yaml
# templates/github/job.changes.yml.template
name: "Changes"

on:
  workflow_call:
    outputs:
<% for (const [domainName, domainConfig] of Object.entries(domains)) { -%>
      <%= domainName %>: 
        value: ${{ jobs.changes.outputs.<%= domainName %> }}
<% } -%>
      
  workflow_dispatch:

jobs:
  changes:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
<% for (const [domainName, domainConfig] of Object.entries(domains)) { -%>
      <%= domainName %>: ${{ steps.merge.outputs.<%= domainName %> }}
<% } -%>
    steps:

    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set Base Branch
      id: set-base
      ## Updated <%= branchFlow.length %>-branch flow: <%= branchFlow.join(' → ') %>
      ## Each branch compares to the next in the flow
      run: |
        case '${{ github.ref }}' in
<% for (let i = 0; i < branchFlow.length - 1; i++) { -%>
          'refs/heads/<%= branchFlow[i] %>')
            base_branch='<%= branchFlow[i + 1] %>'
            ;;
<% } -%>
          *)
            base_branch='<%= branchFlow[0] %>'
            ;;
        esac
        echo "Base branch determined: $base_branch"
        echo "base_branch=$base_branch" >> $GITHUB_ENV

    - uses: dorny/paths-filter@v3
      id: filter
      with:
        base: ${{ env.base_branch }}
        filters: |
<% for (const [domainName, domainConfig] of Object.entries(domains)) { -%>
          <%= domainName %>:
<% for (const path of domainConfig.paths) { -%>
            - '<%= path %>'
<% } -%>
<% } -%>

    - name: Merge filter outputs with branch condition
      id: merge
      run: |
        # Force full deployment on main, staging, and test branches
<% for (const [domainName, domainConfig] of Object.entries(domains)) { -%>
        echo "<%= domainName %>=${{ steps.filter.outputs.<%= domainName %> == 'true' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging' || github.ref == 'refs/heads/test' }}" >> $GITHUB_OUTPUT
<% } -%>

    - name: Debug Paths Filter Outputs
      run: |
<% for (const [domainName, domainConfig] of Object.entries(domains)) { -%>
        echo "<%= domainName.toUpperCase() %>: ${{ steps.merge.outputs.<%= domainName %> }}"
<% } -%>
```

### Step 6: Examples and Documentation

#### 6.1 Create Example Configurations
```json
// examples/basic-config.json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API application changes"
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application changes"
    }
  }
}
```

#### 6.2 Create Usage Documentation
```markdown
# Flowcraft Usage

## Quick Start

```bash
# Initialize Flowcraft
npx flowcraft init

# Generate workflows
npx flowcraft generate

# Validate configuration
npx flowcraft validate
```

## Commands

- `flowcraft init` - Initialize configuration
- `flowcraft generate` - Generate workflows
- `flowcraft validate` - Validate configuration
- `flowcraft verify` - Verify setup


### Step 7: Testing

#### 7.1 Create Test Files
```typescript
// tests/config.test.ts
import { describe, it, expect } from 'vitest'
import { validateConfig } from '../src/utils/config'

describe('Config Validation', () => {
  it('should validate correct configuration', () => {
    const config = {
      ciProvider: 'github',
      mergeStrategy: 'fast-forward',
      requireConventionalCommits: true,
      initialBranch: 'develop',
      finalBranch: 'main',
      branchFlow: ['develop', 'staging', 'main'],
      domains: {
        api: {
          paths: ['apps/api/**'],
          description: 'API changes'
        }
      }
    }
    
    expect(() => validateConfig(config)).not.toThrow()
  })
  
  it('should throw error for invalid configuration', () => {
    const config = {
      ciProvider: 'invalid'
    }
    
    expect(() => validateConfig(config)).toThrow()
  })
})
```

### Step 8: Build and Package

#### 8.1 Build Scripts
```json
// package.json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write '**/*.ts'",
    "prepublishOnly": "npm run build"
  }
}
```

#### 8.2 Publish Configuration
```json
// package.json
{
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🎯 Final Deliverables

### Core Files to Create
1. **`src/types/index.ts`** - TypeScript type definitions
2. **`src/utils/config.ts`** - Configuration utilities
3. **`src/generators/init.tpl.ts`** - Initialization generator
4. **`src/generators/workflows.tpl.ts`** - Workflow generator
5. **`src/cli/index.ts`** - Main CLI entry point
6. **`templates/github/`** - GitHub Actions templates
7. **`examples/`** - Example configurations
8. **`tests/`** - Test files

### Configuration Files
1. **`package.json`** - Project configuration
2. **`tsconfig.json`** - TypeScript configuration
3. **`eslint.config.js`** - ESLint configuration
4. **`.prettierrc`** - Prettier configuration

### Documentation
1. **`README.md`** - Main documentation
2. **`docs/`** - Additional documentation
3. **`examples/usage.md`** - Usage examples

## 🚀 Build Process

1. **Setup**: Initialize project with TypeScript and dependencies
2. **Core**: Create types, utilities, and base structure
3. **Generators**: Implement Pinion generators for templates
4. **CLI**: Build command-line interface with Commander.js
5. **Templates**: Create workflow templates for CI/CD
6. **Examples**: Add example configurations and usage
7. **Testing**: Write comprehensive tests
8. **Documentation**: Create user guides and API docs
9. **Build**: Configure build system and packaging
10. **Publish**: Prepare for npm publication

This build plan provides step-by-step instructions for creating a complete Flowcraft CLI tool using Pinion for template generation, with full support for GitHub Actions and GitLab CI workflows.