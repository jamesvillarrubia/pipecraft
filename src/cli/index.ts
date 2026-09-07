#!/usr/bin/env node

/**
 * PipeCraft Command-Line Interface
 *
 * Main CLI entry point for PipeCraft - automated CI/CD pipeline generator for
 * trunk-based development workflows. This CLI provides commands for:
 *
 * - **init**: Initialize PipeCraft configuration interactively or with flags
 * - **generate**: Generate GitHub Actions workflows from configuration
 * - **validate**: Validate configuration file schema
 * - **doctor**: Run comprehensive diagnostic health checks
 * - **setup**: Configure GitHub repository permissions and settings
 * - **version**: Display version information
 *
 * ## Command Overview
 *
 * ### init
 * Creates .pipecraftrc configuration file with project settings.
 * Can run interactively or accept flags for automation.
 *
 * ### generate
 * Generates GitHub Actions workflows based on configuration:
 * - Main pipeline workflow (.github/workflows/pipeline.yml)
 * - Reusable actions (actions/*)
 * - Idempotent regeneration (only when config/templates change)
 *
 * ### validate
 * Quick validation of configuration file schema.
 *
 * ### doctor
 * Comprehensive diagnostic health check including:
 * - Configuration validation
 * - GitHub workflow permissions
 * - Branch existence on remote
 * - Generated file verification
 * - Workflow semantic validation
 * - Domain path validation
 *
 * ### setup
 * Configures GitHub repository:
 * - Workflow permissions (read/write)
 * - Branch protection rules
 * - Auto-merge settings
 *
 * ## Global Options
 * - `-c, --config <path>`: Path to config file (default: .pipecraftrc)
 * - `-v, --verbose`: Verbose output
 * - `--debug`: Debug output (maximum detail)
 * - `--force`: Force regeneration even if unchanged
 * - `--dry-run`: Show what would be done without making changes
 *
 * ## Examples
 *
 * ```bash
 * # Initialize configuration (prompts; use --yes for CI, scripts and agents)
 * pipecraft init
 *
 * # Generate workflows
 * pipecraft generate
 *
 * # Generate with version management
 * pipecraft init --with-versioning
 * pipecraft generate
 *
 * # Validate existing workflows
 * pipecraft validate
 *
 * # Create the branches in your flow
 * pipecraft setup
 *
 * # Debug mode
 * pipecraft generate --debug
 * ```
 *
 * @module cli
 */

import { prompt, runModule } from '@featherscloud/pinion'
import { Command } from 'commander'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type { PipecraftConfig } from '../types/index.js'
import { loadConfig, validateConfig } from '../utils/config.js'
import { setupGitHubPermissions } from '../utils/github-setup.js'
import { logger } from '../utils/logger.js'
import { formatPreflightResults, runPreflightChecks } from '../utils/preflight.js'
import { VersionManager } from '../utils/versioning.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'))
const version = packageJson.version

const program = new Command()

// Configure the CLI
program
  .name('pipecraft')
  .description('CLI tool for managing trunk-based development workflows')
  .version(version)

// Global options
program
  // No default: when omitted, loadConfig() lets cosmiconfig search and discover any
  // supported format (.pipecraftrc, .pipecraftrc.json/.yml/.yaml/.js, pipecraft.config.js,
  // package.json#pipecraft). A hardcoded '.pipecraftrc' default would force an exact-file
  // load and ENOENT on the common .pipecraftrc.json case.
  .option('-c, --config <path>', 'path to config file (default: auto-discovered)')
  .option(
    '-p, --pipeline <path>',
    'path to existing pipeline file for merging',
    '.github/workflows/pipeline.yml'
  )
  .option(
    '-o, --output-pipeline <path>',
    'path to output pipeline file (for testing)',
    '.github/workflows/pipeline.yml'
  )
  .option('-v, --verbose', 'verbose output')
  .option('--debug', 'debug output (includes all verbose output plus additional debugging info)')
  .option('--force', 'force regeneration even if files unchanged')
  .option('--dry-run', 'show what would be done without making changes')

/** Composite actions `generate` writes into .github/actions/. */
const GENERATED_ACTIONS = [
  'detect-changes',
  'calculate-version',
  'create-tag',
  'create-pr',
  'create-release',
  'manage-branch',
  'promote-branch'
] as const

/**
 * Report what `generate` would do, without doing it.
 *
 * The previous implementation printed one line and returned, which told the reader
 * nothing they did not already know from typing the command. A dry run is for seeing the
 * decision before it is made: which files appear, which get merged into, and which domain
 * jobs the config actually produces. That last one matters most — a domain configured so
 * that it yields no jobs is the most common config mistake (see #499), and this is where
 * it should become visible.
 */
function reportDryRun(config: PipecraftConfig, pipelinePath: string): void {
  const mark = (path: string) => (existsSync(path) ? 'update' : 'create')

  logger.info('🔍 Dry run — no files will be written.\n')

  logger.info('Workflows:')
  for (const file of [
    pipelinePath,
    '.github/workflows/enforce-pr-target.yml',
    ...(config.requireConventionalCommits === false ? [] : ['.github/workflows/pr-title-check.yml'])
  ]) {
    logger.info(`  ${mark(file).padEnd(6)} ${file}`)
  }

  logger.info('\nComposite actions:')
  for (const name of GENERATED_ACTIONS) {
    const file = `.github/actions/${name}/action.yml`
    logger.info(`  ${mark(file).padEnd(6)} ${file}`)
  }

  logger.info('\nRelease config:')
  logger.info(`  ${mark('.release-it.cjs').padEnd(6)} .release-it.cjs`)

  const domains = (config.domains ?? {}) as Record<string, { prefixes?: string[] }>
  const jobs = Object.keys(domains)
    .sort()
    .flatMap(domain => (domains[domain].prefixes ?? []).map(prefix => `${prefix}-${domain}`))

  logger.info('\nDomain jobs:')
  if (jobs.length === 0) {
    logger.info('  (none — no domain declares `prefixes`, so only the managed jobs generate)')
  } else {
    for (const job of jobs) {
      logger.info(`  ${job}`)
    }
  }

  logger.info(
    `\nManaged jobs: changes, version, gate, tag, promote, release` +
      `\nBranch flow:  ${(config.branchFlow ?? []).join(' → ')}`
  )
}

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize pipecraft configuration')
  .option('-f, --force', 'overwrite existing config file')
  .option('--with-versioning', 'include version management setup')
  .option('--with-skill', 'install AI coding assistant skills')
  .option('--ci-provider <provider>', 'CI provider (github|gitlab)', 'github')
  .option('--merge-strategy <strategy>', 'merge strategy (fast-forward|merge)', 'fast-forward')
  .option('--initial-branch <branch>', 'initial development branch', 'develop')
  .option('--final-branch <branch>', 'final production branch', 'main')
  // init is interactive by default; --yes (or a non-TTY stdin) makes it not. A separate
  // --interactive flag existed here and was read by nothing.
  .option('-y, --yes', 'accept defaults and never prompt (for CI, scripts and agents)')
  .action(async options => {
    try {
      const globalOptions = program.opts()

      // The schema accepts "gitlab" as a config value, but nothing under src/ generates
      // anything but GitHub Actions. Writing a "gitlab" config would promise output
      // Pipecraft cannot produce, so init rejects it before writing anything.
      if (options.ciProvider === 'gitlab') {
        throw new Error(
          'ciProvider "gitlab" is not supported yet. Pipecraft generates GitHub Actions workflows only.'
        )
      }

      // init prompted for everything and ignored these flags entirely, so it could not be
      // run by a script, by CI, or by a coding agent — it died on "User force closed the
      // prompt" with stdin closed. Skip prompting when asked to, or when there is no
      // terminal to prompt on.
      const nonInteractive = Boolean(options.yes) || !process.stdin.isTTY

      await runModule(join(__dirname, '../generators/init.tpl.js'), {
        cwd: process.cwd(),
        argv: process.argv,
        // Extra keys the init generator reads; PinionContext is not extensible here.
        nonInteractive,
        ciProvider: options.ciProvider,
        mergeStrategy: options.mergeStrategy,
        initialBranch: options.initialBranch,
        finalBranch: options.finalBranch,
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
      } as any)

      // Setup version management if requested
      if (options.withVersioning) {
        const config = loadConfig(globalOptions.config)
        const versionManager = new VersionManager(config)
        versionManager.setupVersionManagement()
        console.log('✅ Version management setup completed!')
      }

      // Install AI skills if requested
      if (options.withSkill) {
        const { installSkills } = await import('../utils/skill-installer.js')
        console.log('\n🔧 Installing AI coding assistant skills...')
        // `init` runs in the project being set up, so the project files are the ones to write.
        const results = installSkills({ local: true })
        const installed = results.filter(r => r.success && !r.skipped)
        if (installed.length > 0) {
          console.log('✅ Skills installed for:', installed.map(r => r.target).join(', '))
        }
      }

      console.log('✅ Configuration initialized successfully!')

      // Hint about skill installation if not already done
      if (!options.withSkill) {
        console.log(
          '\n💡 Tip: Run `pipecraft skill` to install AI assistant skills (Claude, Cursor, etc.)'
        )
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('❌ Failed to initialize configuration:', message)
      process.exit(1)
    }
  })

// Generate command - Generate workflow files
program
  .command('generate')
  .description('Generate CI/CD workflows from configuration')
  .option('-o, --output <path>', 'output directory for generated workflows', '.github/workflows')
  .option('--skip-unchanged', "skip files that haven't changed")
  .option('--skip-checks', 'skip pre-flight checks (not recommended)')
  .action(async options => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      const pipelinePath = globalOptions.pipeline
      const outputPipelinePath = globalOptions.outputPipeline

      // Set logger level based on flags
      if (globalOptions.debug) {
        logger.setLevel('debug')
      } else if (globalOptions.verbose) {
        logger.setLevel('verbose')
      }

      // Run pre-flight checks unless skipped
      if (!options.skipChecks) {
        logger.info('🔍 Running pre-flight checks...\n')

        const checks = runPreflightChecks()
        const { allPassed, output, nextSteps } = formatPreflightResults(checks)

        logger.info(output)
        logger.info('')

        if (!allPassed) {
          logger.error('❌ Pre-flight checks failed. Fix the issues above and try again.')
          logger.error('   Or use --skip-checks to bypass (not recommended)\n')
          process.exit(1)
        }

        logger.info('✅ All pre-flight checks passed!')

        // Store next steps for later display (after successful generation)
        if (nextSteps) {
          ;(options as any)._nextSteps = nextSteps
        }

        logger.info('')
      }

      logger.verbose(`📖 Reading config from: ${configPath}`)
      logger.verbose(`📖 Reading pipeline from: ${pipelinePath}`)

      // Load and validate configuration
      const config = loadConfig(configPath) as PipecraftConfig
      validateConfig(config)

      // The schema accepts "gitlab" as a config value, but nothing under src/ generates
      // anything but GitHub Actions. `init --ci-provider gitlab` already rejects this at
      // write time (src/cli/index.ts, init's own action); a hand-written or older config
      // reaches generate directly, so generate rejects it here too.
      if (config.ciProvider === 'gitlab') {
        throw new Error(
          'ciProvider "gitlab" is not supported yet. Pipecraft generates GitHub Actions workflows only.'
        )
      }

      if (globalOptions.dryRun) {
        reportDryRun(config, pipelinePath)
        return
      }

      // Display mode message
      if (globalOptions.force) {
        logger.info('🔄 Force mode: Complete rebuild of all workflows')
      } else {
        logger.info('✨ Additive mode: Merging with existing workflows')
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

      logger.success(`✅ Generated workflows in: ${options.output}`)

      // Display next steps if available
      if ((options as any)._nextSteps) {
        logger.info('')
        const steps = (options as any)._nextSteps as string[]
        steps.forEach((step: string) => logger.info(step))
      }
    } catch (error: any) {
      logger.error('❌ Failed to generate workflows:', error.message)
      process.exit(1)
    }
  })

// Get-config command - Get configuration value
program
  .command('get-config')
  .description('Get a configuration value by key path (supports JSON, YAML, JS, etc.)')
  .argument('<key>', 'key path to retrieve (e.g., "branchFlow" or "autoPromote.staging")')
  .option('--format <format>', 'output format: json, space-separated, or raw', 'raw')
  .action(async (key, options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config

      const config = loadConfig(configPath)
      validateConfig(config)

      // Parse nested key path (e.g., "autoPromote.staging")
      const getValue = (obj: any, path: string): any => {
        return path.split('.').reduce((current, key) => {
          return current?.[key]
        }, obj)
      }

      const value = getValue(config, key)

      if (value === undefined) {
        console.error(`Key "${key}" not found in configuration`)
        process.exit(1)
      }

      // Output value based on format
      if (options.format === 'json') {
        console.log(JSON.stringify(value))
      } else if (options.format === 'space-separated' && Array.isArray(value)) {
        console.log(value.join(' '))
      } else if (Array.isArray(value)) {
        // Default for arrays: space-separated
        console.log(value.join(' '))
      } else if (typeof value === 'object' && value !== null) {
        // Default for objects: JSON
        console.log(JSON.stringify(value))
      } else {
        // Default for primitives: raw value
        console.log(value)
      }
    } catch (error: any) {
      console.error(`❌ Failed to get config value: ${error.message}`)
      process.exit(1)
    }
  })

// Validate command - Validate configuration file (quick schema check)
program
  .command('validate')
  .description('Validate configuration file')
  .action(async () => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config

      const config = loadConfig(configPath)
      validateConfig(config)

      console.log('✅ Configuration is valid!')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('❌ Configuration validation failed:', message)
      process.exit(1)
    }
  })

// Doctor command - Comprehensive health check
program
  .command('doctor')
  .description('Run diagnostic checks on your Pipecraft setup')
  .action(async () => {
    try {
      const { runDoctor, formatDoctorOutput } = await import('../utils/doctor.js')

      const result = await runDoctor()
      console.log(formatDoctorOutput(result))

      // Exit with error code if there are errors
      if (result.errorCount > 0) {
        process.exit(1)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('❌ Doctor command failed:', message)
      process.exit(1)
    }
  })

// Version command - Version management
// Bumping and releasing belong to the pipeline, not to a developer's laptop: the `version`
// job resolves the version and `tag`/`release` act on it. This command reports only.
// `--bump` and `--release` existed here as stubs that printed success and did nothing.
program
  .command('version')
  .description('Report the current and next version. Bumping happens in the pipeline.')
  .option('--check', 'check current version and next version')
  .action(async options => {
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
  .action(async options => {
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
            // `git branch` creates the ref without switching. The previous
            // `git checkout -b` moved the working tree and then tried to switch back at
            // the end, outside any try/finally — so a failure anywhere in this loop left
            // the user on a branch they never chose, and uncommitted work could block the
            // checkout or ride along to another branch. Creating refs needs no checkout.
            execSync(`git branch ${branch}`, { stdio: 'inherit' })
            console.log(`✅ Created branch '${branch}'`)
          } catch (error: any) {
            if (error.message.includes('already exists')) {
              console.log(`ℹ️  Branch '${branch}' already exists (checked out from remote)`)
            } else {
              throw error
            }
          }
        }

        // Push branch to remote if it doesn't exist there.
        // NOTE: `git ls-remote --heads origin <branch>` exits 0 even when the branch is
        // absent (empty output) — so we must check the OUTPUT, not whether it throws.
        // The previous `try/catch` always took the "exists" path and never pushed.
        console.log(`📤 Checking if '${branch}' exists on remote...`)
        const remoteRef = execSync(`git ls-remote --heads origin ${branch}`, {
          encoding: 'utf8'
        }).trim()
        if (remoteRef.length > 0) {
          console.log(`✅ Branch '${branch}' already exists on remote`)
        } else {
          console.log(`🚀 Pushing branch '${branch}' to remote...`)
          execSync(`git push -u origin ${branch}`, { stdio: 'inherit' })
          console.log(`✅ Pushed branch '${branch}' to remote`)
        }
      }

      // No branch to return to: nothing above switched away from it.
      console.log(`✅ Branch setup complete! Still on '${currentBranch}'.`)
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
  .option('--verbose', 'Show detailed technical information')
  .action(async options => {
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

// Skill command - Install AI coding assistant skills
program
  .command('skill')
  .description('Install Pipecraft skills for AI coding assistants (Claude Code, Cursor, etc.)')
  .option('--install', 'Install skills (default action)')
  .option('--uninstall', 'Remove what was installed, leaving your own text in place')
  .option('--list', 'List available targets and their status')
  .option('--local', 'Install into this project (default)')
  .option('--global', 'Install into your home directory (Claude Code only)')
  .option(
    '--target <targets>',
    'Specific targets (comma-separated: claude-code,cursor,copilot,windsurf,cline,codex)'
  )
  .action(async options => {
    try {
      const { installSkills, uninstallSkills, listSkillTargets, SKILL_TARGETS } = await import(
        '../utils/skill-installer.js'
      )

      const targetList = options.target?.split(',').map((t: string) => t.trim())
      const known = SKILL_TARGETS.map(t => t.name)
      const unknown = (targetList ?? []).filter((t: string) => !known.includes(t))
      if (unknown.length > 0) {
        console.error(`❌ Unknown target(s): ${unknown.join(', ')}`)
        console.error(`   Known targets: ${known.join(', ')}`)
        process.exit(1)
      }

      // List mode
      if (options.list) {
        const targets = listSkillTargets()
        console.log('\n📋 AI Coding Assistant Skill Targets:\n')

        for (const target of targets) {
          const status = target.hasLocalSkill
            ? '✅ Installed (project)'
            : target.hasGlobalSkill
            ? '✅ Installed (global)'
            : target.detected
            ? '⚠️  Detected (no skill)'
            : '⬚  Not detected'
          const path = target.hasLocalSkill
            ? target.localPath
            : target.hasGlobalSkill
            ? target.globalPath!
            : target.localPath
          console.log(`   ${status}  ${target.displayName}`)
          console.log(`             ${path}`)
        }

        console.log('\nRun `pipecraft skill --install` to install skills.')
        console.log('')
        return
      }

      // Uninstall mode
      if (options.uninstall) {
        console.log('\n🗑️  Removing Pipecraft skills...\n')

        const results = uninstallSkills({
          global: options.global,
          local: options.local,
          targets: targetList
        })

        const removed = results.filter(r => r.success)
        if (removed.length > 0) {
          console.log('Removed from:')
          for (const r of removed) {
            console.log(`   ✅ ${r.target}: ${r.path}`)
          }
        } else {
          console.log('No skills found to remove.')
        }
        console.log('')
        return
      }

      // Install mode (default)
      console.log('\n🔧 Installing Pipecraft skills for AI coding assistants...\n')

      const results = installSkills({
        global: options.global,
        local: options.local,
        targets: targetList
      })

      const installed = results.filter(r => r.success && !r.skipped)
      const skipped = results.filter(r => r.skipped)
      const failed = results.filter(r => !r.success && !r.skipped)

      if (installed.length > 0) {
        console.log('✅ Installed to:')
        for (const r of installed) {
          console.log(`   ${r.target}: ${r.path}`)
        }
      }

      if (skipped.length > 0) {
        console.log('\n⏭️  Skipped:')
        for (const r of skipped) {
          console.log(`   ${r.target}: ${r.reason}`)
        }
      }

      if (failed.length > 0) {
        console.log('\n❌ Failed:')
        for (const r of failed) {
          console.log(`   ${r.target}: ${r.error}`)
        }
      }

      if (installed.length > 0) {
        console.log('\n📝 Notes:')
        console.log('   Claude Code reads .claude/skills/pipecraft/SKILL.md.')
        console.log(
          '   The rules files keep your own text; Pipecraft only maintains the block between'
        )
        console.log('   <!-- pipecraft:start --> and <!-- pipecraft:end -->.')
        console.log('   Run `pipecraft skill --uninstall` to remove that block.')
      }

      console.log('')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('❌ Skill command failed:', message)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
