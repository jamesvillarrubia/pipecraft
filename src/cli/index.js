#!/usr/bin/env node

import { Command } from 'commander'
import { cosmiconfigSync } from 'cosmiconfig'
import { join } from 'path'
import { generateFromConfig } from '../generators/workflow-generator.js'
import { generateAllWorkflows } from '../generators/multi-workflow-generator.js'
import { initConfig } from './init.js'
import { validateConfig } from './validate.js'

const program = new Command()

// Configure the CLI
program
  .name('trunkflow')
  .description('CLI tool for managing trunk-based development workflows')
  .version('1.0.0')

// Global options
program
  .option('-c, --config <path>', 'path to config file', '.trunkflowrc.json')
  .option('-v, --verbose', 'verbose output')

// Init command - Initialize configuration
program
  .command('init')
  .description('Initialize trunkflow configuration')
  .option('-f, --force', 'overwrite existing config')
  .option('-i, --interactive', 'interactive setup wizard')
  .action(async (options) => {
    try {
      await initConfig(options)
      console.log('✅ Configuration initialized successfully!')
    } catch (error) {
      console.error('❌ Failed to initialize configuration:', error.message)
      process.exit(1)
    }
  })

// Generate command - Generate workflow files
program
  .command('generate')
  .description('Generate GitHub Actions workflows from configuration')
  .option('-o, --output <path>', 'output directory for generated workflows', '.github/workflows')
  .option('--single', 'generate only the changes workflow (legacy mode)')
  .option('--dry-run', 'show what would be generated without writing files')
  .action(async (options) => {
    try {
      const globalOptions = program.opts()
      const configPath = globalOptions.config
      
      if (globalOptions.verbose) {
        console.log(`📖 Reading config from: ${configPath}`)
      }
      
      if (options.single) {
        // Legacy mode - generate only changes workflow
        await generateFromConfig(configPath, join(options.output, 'job.changes.yml'))
        console.log(`✅ Generated changes workflow at: ${join(options.output, 'job.changes.yml')}`)
      } else {
        // Generate all workflows
        await generateAllWorkflows(configPath, options.output)
        console.log(`✅ Generated all workflows in: ${options.output}`)
      }
      
      if (options.dryRun) {
        console.log('🔍 Dry run completed - no files were written')
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
      
      await validateConfig(configPath)
      console.log('✅ Configuration is valid!')
    } catch (error) {
      console.error('❌ Configuration validation failed:', error.message)
      process.exit(1)
    }
  })

// Verify command - Check if setup is correct
program
  .command('verify')
  .description('Verify that trunkflow is properly set up')
  .action(async () => {
    try {
      const explorer = cosmiconfigSync('trunkflow')
      const result = explorer.search()
      
      if (!result) {
        console.log('⚠️  No configuration file found. Run "trunkflow init" to get started.')
        process.exit(1)
      }
      
      console.log(`✅ Found configuration at: ${result.filepath}`)
      
      // Validate the config
      await validateConfig(result.filepath)
      console.log('✅ Configuration is valid!')
      
      // Check if workflow exists
      const fs = await import('fs')
      const path = await import('path')
      
      const workflowPath = path.join(process.cwd(), '.github/workflows/job.changes.yml')
      if (fs.existsSync(workflowPath)) {
        console.log('✅ GitHub Actions workflow exists!')
      } else {
        console.log('⚠️  GitHub Actions workflow not found. Run "trunkflow generate" to create it.')
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
