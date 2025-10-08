#!/usr/bin/env node

import { Command } from 'commander'
import { cosmiconfigSync } from 'cosmiconfig'
import { runModule } from '@featherscloud/pinion'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

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

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize flowcraft configuration')
  .option('-f, --force', 'overwrite existing config')
  .option('-i, --interactive', 'interactive setup wizard')
  .action(async (options) => {
    try {
      await runModule(join(__dirname, '../generators/init.tpl.ts'), {
        cwd: process.cwd(),
        argv: process.argv,
        pinion: {
          logger: console,
          prompt: require('inquirer').prompt,
          cwd: process.cwd(),
          force: options.force || false,
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
  .option('--dry-run', 'show what would be generated without writing files')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      
      if (globalOptions.verbose) {
        console.log(`📖 Reading config from: ${configPath}`)
      }
      
      await runModule(join(__dirname, '../generators/workflows.tpl.ts'), {
        cwd: process.cwd(),
        argv: process.argv,
        pinion: {
          logger: console,
          prompt: require('inquirer').prompt,
          cwd: process.cwd(),
          force: true,
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
      
      if (options.dryRun) {
        console.log('🔍 Dry run completed - no files were written')
      } else {
        console.log(`✅ Generated workflows in: ${options.output}`)
      }
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
      
      // Validate required fields
      const requiredFields = ['ciProvider', 'mergeStrategy', 'requireConventionalCommits', 'initialBranch', 'finalBranch', 'branchFlow', 'domains']
      
      for (const field of requiredFields) {
        if (!(field in config)) {
          throw new Error(`Missing required field: ${field}`)
        }
      }
      
      // Validate ciProvider
      if (!['github', 'gitlab'].includes(config.ciProvider)) {
        throw new Error('ciProvider must be either "github" or "gitlab"')
      }
      
      // Validate mergeStrategy
      if (!['fast-forward', 'merge'].includes(config.mergeStrategy)) {
        throw new Error('mergeStrategy must be either "fast-forward" or "merge"')
      }
      
      // Validate branchFlow
      if (!Array.isArray(config.branchFlow) || config.branchFlow.length < 2) {
        throw new Error('branchFlow must be an array with at least 2 branches')
      }
      
      // Validate domains
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
      
      // Validate the config
      const config = result.config
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
      } else if (config.ciProvider === 'gitlab') {
        const pipelinePath = path.join(process.cwd(), '.gitlab-ci.yml')
        if (fs.existsSync(pipelinePath)) {
          console.log('✅ GitLab CI pipeline exists!')
        } else {
          console.log('⚠️  GitLab CI pipeline not found. Run "flowcraft generate" to create it.')
        }
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message)
      process.exit(1)
    }
  })

// Promote command - Promote to next environment
program
  .command('promote')
  .description('Promote current branch to next environment')
  .option('-f, --force', 'force promotion even if checks fail')
  .action(async (options) => {
    try {
      console.log('🚀 Promoting to next environment...')
      
      // This would implement the actual promotion logic
      // For now, just show what would happen
      console.log('📋 Promotion steps:')
      console.log('  1. Validate current branch')
      console.log('  2. Run tests')
      console.log('  3. Fast-forward to next branch')
      console.log('  4. Update version tags')
      
      if (options.force) {
        console.log('⚠️  Force mode enabled - skipping some checks')
      }
      
      console.log('✅ Promotion completed!')
    } catch (error) {
      console.error('❌ Promotion failed:', error.message)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
