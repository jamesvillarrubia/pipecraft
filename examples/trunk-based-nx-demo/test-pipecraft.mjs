#!/usr/bin/env node

import * as gitManager from './test-utils/git-manager.mjs'
import * as pipecraftRunner from './test-utils/pipecraft-runner.mjs'
import * as customJobInjector from './test-utils/custom-job-injector.mjs'
import * as actRunner from './test-utils/act-runner.mjs'
import * as testReporter from './test-utils/test-reporter.mjs'
import fs from 'fs/promises'

const results = {
  nxSetup: null,
  actInstalled: false,
  generation1: null,
  customJobInjection: null,
  generation2: null,
  customJobResults: null,
  scenarioResults: null
}

const options = {
  skipAct: process.argv.includes('--skip-act'),
  keepArtifacts: process.argv.includes('--keep-artifacts'),
  cleanOnly: process.argv.includes('--clean-only'),
  verbose: process.argv.includes('--verbose')
}

async function main() {
  console.log('🚀 PipeCraft Nx Integration Test Suite\n')
  console.log('Options:')
  console.log(`  Skip act: ${options.skipAct}`)
  console.log(`  Keep artifacts: ${options.keepArtifacts}`)
  console.log(`  Clean only: ${options.cleanOnly}`)
  console.log(`  Verbose: ${options.verbose}\n`)

  try {
    // Handle clean-only mode
    if (options.cleanOnly) {
      console.log('🧹 Clean-only mode: Removing generated files...\n')
      await pipecraftRunner.cleanPipecraftFiles()
      console.log('\n✅ Cleanup complete')
      return
    }

    // Phase 0: Pre-flight Checks
    console.log('═'.repeat(60))
    console.log('PHASE 0: Pre-flight Checks')
    console.log('═'.repeat(60) + '\n')

    // Check if we're in a git repo
    if (!gitManager.checkGitRepo()) {
      throw new Error('Not a git repository. Please run this script from the demo directory.')
    }

    console.log('✅ Git repository detected')

    // Check Nx setup
    results.nxSetup = await pipecraftRunner.checkNxSetup()

    if (!results.nxSetup.success) {
      throw new Error('Nx setup is incomplete. Please ensure all required files exist.')
    }

    // Check act installation (if not skipping)
    if (!options.skipAct) {
      const actCheck = actRunner.checkActInstalled()
      results.actInstalled = actCheck.installed

      if (!actCheck.installed) {
        console.log('\n⚠️  act is not installed. Scenarios will be skipped.')
        console.log('Install act: brew install act (macOS) or https://github.com/nektos/act\n')
        options.skipAct = true
      }
    }

    // Phase 1: Git State Setup
    console.log('\n' + '═'.repeat(60))
    console.log('PHASE 1: Git State Setup')
    console.log('═'.repeat(60) + '\n')

    const baselineTag = gitManager.createBaselineTag()
    const testBranch = gitManager.createTestBranch()

    console.log(`\n✅ Git state prepared`)
    console.log(`   Baseline: ${baselineTag}`)
    console.log(`   Test branch: ${testBranch}`)

    // Phase 2: Initial PipeCraft Generation
    console.log('\n' + '═'.repeat(60))
    console.log('PHASE 2: Initial PipeCraft Generation')
    console.log('═'.repeat(60) + '\n')

    await pipecraftRunner.runPipecraftInit()
    results.generation1 = await pipecraftRunner.runPipecraftGenerate()

    if (!results.generation1.success) {
      throw new Error(`Initial generation failed: ${results.generation1.error}`)
    }

    const generatedFiles1 = await pipecraftRunner.captureGeneratedFiles()
    console.log(`\n✅ Generated ${generatedFiles1.length} workflow files`)

    // Phase 3: Inject Custom Jobs
    console.log('\n' + '═'.repeat(60))
    console.log('PHASE 3: Inject Custom Jobs')
    console.log('═'.repeat(60) + '\n')

    const pipelinePath = '.github/workflows/pipeline.yml'

    try {
      await fs.access(pipelinePath)
    } catch {
      throw new Error(`Pipeline file not found: ${pipelinePath}`)
    }

    results.customJobInjection = await customJobInjector.injectCustomJobs(pipelinePath)

    const customJobs = results.customJobInjection.customJobs

    console.log(`\n✅ Injected ${customJobs.length} custom jobs`)

    // Commit custom jobs
    gitManager.createTestCommit('test: add custom jobs to pipeline', [pipelinePath])

    // Phase 4: Regenerate (Idempotency Test)
    console.log('\n' + '═'.repeat(60))
    console.log('PHASE 4: Regenerate (Idempotency Test)')
    console.log('═'.repeat(60) + '\n')

    console.log('🔄 Regenerating workflows to test idempotency...\n')

    results.generation2 = await pipecraftRunner.runPipecraftGenerate()

    if (!results.generation2.success) {
      throw new Error(`Regeneration failed: ${results.generation2.error}`)
    }

    const generatedFiles2 = await pipecraftRunner.captureGeneratedFiles()
    console.log(`\n✅ Regenerated ${generatedFiles2.length} workflow files`)

    // Verify custom jobs were preserved
    console.log('\n🔍 Verifying custom jobs were preserved...\n')
    results.customJobResults = await customJobInjector.verifyJobsPreserved(pipelinePath, customJobs)

    if (!results.customJobResults.allPreserved) {
      console.log('\n⚠️  Some custom jobs were lost during regeneration!')
      console.log('This indicates an idempotency issue with PipeCraft.')
    } else {
      console.log('\n✅ All custom jobs preserved - idempotency verified!')
    }

    // Phase 5: Act Testing Scenarios (if not skipped)
    if (!options.skipAct) {
      console.log('\n' + '═'.repeat(60))
      console.log('PHASE 5: Act Testing Scenarios')
      console.log('═'.repeat(60) + '\n')

      // Load scenarios from config
      const configPath = './test-pipecraft-config.json'

      let scenarios = []

      try {
        const configContent = await fs.readFile(configPath, 'utf8')
        const config = JSON.parse(configContent)
        scenarios = config.scenarios || []
        console.log(`✅ Loaded ${scenarios.length} scenarios from config\n`)
      } catch (error) {
        console.log(`⚠️  Could not load scenarios: ${error.message}`)
        console.log('Continuing without act scenarios...\n')
      }

      if (scenarios.length > 0) {
        results.scenarioResults = await actRunner.runActScenarios(scenarios)
      }
    } else {
      console.log('\n⏭️  Skipping act scenarios (--skip-act flag or act not installed)')
    }

    // Phase 6: Generate Report
    console.log('\n' + '═'.repeat(60))
    console.log('PHASE 6: Generate Report')
    console.log('═'.repeat(60) + '\n')

    const { allPassed } = await testReporter.generateReport(results)
    await testReporter.generateSummary(results)

    // Phase 7: Cleanup (if not keeping artifacts)
    if (!options.keepArtifacts) {
      console.log('\n' + '═'.repeat(60))
      console.log('PHASE 7: Cleanup')
      console.log('═'.repeat(60) + '\n')

      console.log('🧹 Cleaning up test artifacts...')

      // Switch back to original branch and delete test branch
      const originalBranch = 'develop'

      try {
        gitManager.exec(`git checkout ${originalBranch}`)
        console.log(`  ✅ Switched back to ${originalBranch}`)
      } catch (error) {
        console.log(`  ⚠️  Could not switch to ${originalBranch}: ${error.message}`)
      }

      gitManager.deleteTestBranches()

      console.log('\n✅ Cleanup complete')
    } else {
      console.log('\n⏭️  Skipping cleanup (--keep-artifacts flag)')
    }

    // Exit with appropriate code
    console.log('\n' + '═'.repeat(60))
    console.log('TEST SUITE COMPLETE')
    console.log('═'.repeat(60) + '\n')

    if (allPassed) {
      console.log('🎉 All tests passed!')
      process.exit(0)
    } else {
      console.log('⚠️  Some tests failed. Review TEST-REPORT.md for details.')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Test suite failed with error:')
    console.error(error.message)

    if (options.verbose) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }

    process.exit(1)
  }
}

// Run the test suite
main()
