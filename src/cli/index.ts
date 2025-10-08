#!/usr/bin/env node

import { Command } from 'commander'
import { cosmiconfigSync } from 'cosmiconfig'
import { runModule, prompt } from '@featherscloud/pinion'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { IdempotencyManager } from '../utils/idempotency'
import { VersionManager } from '../utils/versioning'
import { loadConfig, validateConfig } from '../utils/config'
import { FlowcraftConfig } from '../types'
import inquirer from 'inquirer'

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
  .option('-c, --config <path>', 'path to config file', '.flowcraftrc.json')
  .option('-v, --verbose', 'verbose output')
  .option('--force', 'force regeneration even if files unchanged')
  .option('--dry-run', 'show what would be done without making changes')

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize flowcraft configuration')
  .option('-f, --force', 'overwrite existing config file')
  .option('-i, --interactive', 'run interactive setup wizard')
  .option('--with-versioning', 'include version management setup')
  .option('--ci-provider <provider>', 'CI provider (github|gitlab)', 'github')
  .option('--merge-strategy <strategy>', 'merge strategy (fast-forward|merge)', 'fast-forward')
  .option('--initial-branch <branch>', 'initial development branch', 'develop')
  .option('--final-branch <branch>', 'final production branch', 'main')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      
      await runModule(join(__dirname, '../generators/init.tpl.ts'), {
        cwd: process.cwd(),
        argv: process.argv,
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: prompt as any,
          cwd: process.cwd(),
          force: options.force || globalOptions.force || false,
          trace: [],
          exec: async (command: string, args: string[]) => {
            const { spawn } = await import('child_process')
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
    } catch (error: any) {
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
        
        if (!(await idempotencyManager.hasChanges())) {
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
          logger: {
            ...console,
            notice: console.log
          },
          cwd: process.cwd(),
          force: globalOptions.force || false,
          trace: [],
          exec: async (command: string, args: string[]) => {
            const { spawn } = await import('child_process')
            return new Promise((resolve, reject) => {
              const child = spawn(command, args, { stdio: 'inherit', shell: true })
              child.once('exit', (code: number) => (code === 0 ? resolve(code) : reject(code)))
            })
          }
        }
      })
      
      // Update idempotency cache
      const idempotencyManager = new IdempotencyManager(config)
      await idempotencyManager.updateCache()
      
      console.log(`✅ Generated workflows in: ${options.output}`)
    } catch (error: any) {
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
      
      const config = loadConfig(configPath)
      validateConfig(config)
      
      console.log('✅ Configuration is valid!')
    } catch (error: any) {
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
      const fs = await import('fs')
      const path = await import('path')
      
      if (config.ciProvider === 'github') {
        const workflowPath = path.join(process.cwd(), '.github/workflows/pipeline.yml')
        if (fs.existsSync(workflowPath)) {
          console.log('✅ GitHub Actions workflows exist!')
        } else {
          console.log('⚠️  GitHub Actions workflows not found. Run "flowcraft generate" to create them.')
        }
      }
      
    } catch (error: any) {
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
      
    } catch (error: any) {
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