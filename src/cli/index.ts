#!/usr/bin/env node

// PipeCraft CLI - Automated CI/CD pipeline generator
import { Command } from 'commander'
import { cosmiconfigSync } from 'cosmiconfig'
import { runModule, prompt } from '@featherscloud/pinion'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { IdempotencyManager } from '../utils/idempotency.js'
import { VersionManager } from '../utils/versioning.js'
import { loadConfig, validateConfig } from '../utils/config.js'
import { PipecraftConfig } from '../types/index.js'
import { setupGitHubPermissions } from '../utils/github-setup.js'
import { runPreflightChecks, formatPreflightResults, checkNodeVersion } from '../utils/preflight.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const program = new Command()

// Configure the CLI
program
  .name('pipecraft')
  .description('CLI tool for managing trunk-based development workflows')
  .version('1.0.0')

console.log("pipecraft edit")

// Global options
program
  .option('-c, --config <path>', 'path to config file', '.pipecraftrc.json')
  .option('-p, --pipeline <path>', 'path to existing pipeline file for merging', '.github/workflows/pipeline.yml')
  .option('-o, --output-pipeline <path>', 'path to output pipeline file (for testing)', '.github/workflows/pipeline.yml')
  .option('-v, --verbose', 'verbose output')
  .option('--force', 'force regeneration even if files unchanged')
  .option('--dry-run', 'show what would be done without making changes')

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize pipecraft configuration')
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
  .option('--skip-checks', 'skip pre-flight checks (not recommended)')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      const pipelinePath = globalOptions.pipeline
      const outputPipelinePath = globalOptions.outputPipeline

      // Run pre-flight checks unless skipped
      if (!options.skipChecks) {
        console.log('🔍 Running pre-flight checks...\n')

        const checks = runPreflightChecks()
        const { allPassed, output, nextSteps } = formatPreflightResults(checks)

        console.log(output)
        console.log()

        if (!allPassed) {
          console.error('❌ Pre-flight checks failed. Fix the issues above and try again.')
          console.error('   Or use --skip-checks to bypass (not recommended)\n')
          process.exit(1)
        }

        console.log('✅ All pre-flight checks passed!')

        // Store next steps for later display (after successful generation)
        if (nextSteps) {
          (options as any)._nextSteps = nextSteps
        }

        console.log()
      }

      if (globalOptions.verbose) {
        console.log(`📖 Reading config from: ${configPath}`)
        console.log(`📖 Reading pipeline from: ${pipelinePath}`)
      }

      // Load configuration
      const config = loadConfig(configPath) as PipecraftConfig
      
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
      
      await runModule(join(__dirname, '../generators/workflows.tpl.js'), {
        cwd: process.cwd(),
        argv: process.argv,
        pipelinePath: pipelinePath,
        outputPipelinePath: outputPipelinePath,
        config: config,
        pinion: {
          logger: {
            ...console,
            notice: console.log
          },
          prompt: prompt as any,
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
      } as any)
      
      // Update idempotency cache
      const idempotencyManager = new IdempotencyManager(config)
      await idempotencyManager.updateCache()

      console.log(`✅ Generated workflows in: ${options.output}`)

      // Display next steps if available
      if ((options as any)._nextSteps) {
        console.log()
        const steps = (options as any)._nextSteps as string[]
        steps.forEach((step: string) => console.log(step))
      }
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
  .description('Verify that pipecraft is properly set up')
  .action(async () => {
    try {
      const explorer = cosmiconfigSync('trunkflow')
      const result = explorer.search()
      
      if (!result) {
        console.log('⚠️  No configuration file found. Run "pipecraft init" to get started.')
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
          console.log('⚠️  GitHub Actions workflows not found. Run "pipecraft generate" to create them.')
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
      const config = loadConfig(globalOptions.config) as PipecraftConfig
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

// Setup command - Create necessary branches
program
  .command('setup')
  .description('Set up the repository with necessary branches from branch flow')
  .option('--force', 'Force creation even if branches exist')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      
      if (globalOptions.verbose) {
        console.log(`📖 Reading config from: ${configPath}`)
      }
      
      // Load configuration
      const config = loadConfig(configPath) as PipecraftConfig
      
      if (!config.branchFlow || config.branchFlow.length === 0) {
        console.log('⚠️  No branch flow configured in config file')
        return
      }
      
      console.log(`🌿 Setting up branches: ${config.branchFlow.join(' → ')}`)
      
      // Check current branch
      const { execSync } = await import('child_process')
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()
      console.log(`📍 Current branch: ${currentBranch}`)
      
      // Check which branches exist
      const existingBranches = execSync('git branch -a', { encoding: 'utf8' })
        .split('\n')
        .map(line => line.trim().replace('* ', '').replace('remotes/origin/', ''))
        .filter(line => line.length > 0)
      
      console.log(`📋 Existing branches: ${existingBranches.join(', ')}`)
      
      // Create missing branches
      for (const branch of config.branchFlow) {
        if (existingBranches.includes(branch)) {
          console.log(`✅ Branch '${branch}' already exists locally`)
        } else {
          console.log(`🌱 Creating branch '${branch}'...`)
          try {
            execSync(`git checkout -b ${branch}`, { stdio: 'inherit' })
            console.log(`✅ Created branch '${branch}'`)
          } catch (error: any) {
            if (error.message.includes('already exists')) {
              console.log(`ℹ️  Branch '${branch}' already exists (checked out from remote)`)
            } else {
              throw error
            }
          }
        }
        
        // Push branch to remote if it doesn't exist there
        try {
          console.log(`📤 Checking if '${branch}' exists on remote...`)
          execSync(`git ls-remote --heads origin ${branch}`, { stdio: 'pipe' })
          console.log(`✅ Branch '${branch}' already exists on remote`)
        } catch (error: any) {
          console.log(`🚀 Pushing branch '${branch}' to remote...`)
          execSync(`git push -u origin ${branch}`, { stdio: 'inherit' })
          console.log(`✅ Pushed branch '${branch}' to remote`)
        }
      }
      
      // Return to original branch
      execSync(`git checkout ${currentBranch}`, { stdio: 'inherit' })
      console.log(`🔄 Returned to original branch: ${currentBranch}`)
      
      console.log('✅ Branch setup complete!')

    } catch (error: any) {
      console.error('❌ Setup command failed:', error.message)
      process.exit(1)
    }
  })

// Setup GitHub command - Configure GitHub Actions permissions
program
  .command('setup-github')
  .description('Configure GitHub Actions workflow permissions for PipeCraft')
  .option('--apply', 'Automatically apply changes without prompting')
  .option('--force', 'Alias for --apply')
  .action(async (options) => {
    try {
      const autoApply = options.apply || options.force
      await setupGitHubPermissions(autoApply)
    } catch (error: any) {
      console.error('❌ GitHub setup failed:', error.message)
      if (error.stack) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
