import fs from 'fs/promises'

export async function generateReport(results, options = {}) {
  const { outputPath = 'TEST-REPORT.md' } = options

  console.log('📝 Generating test report...')

  const report = []

  report.push('# PipeCraft Nx Integration Test Report\n')
  report.push(`**Generated:** ${new Date().toISOString()}\n`)
  report.push('---\n\n')

  // Pre-flight checks
  report.push('## Pre-flight Checks\n')

  if (results.nxSetup) {
    report.push('### Nx Setup\n')
    const { success, checks } = results.nxSetup

    if (success) {
      report.push('✅ **Status:** All checks passed\n\n')
    } else {
      report.push('❌ **Status:** Some checks failed\n\n')
    }

    report.push('| Check | Status |\n')
    report.push('|-------|--------|\n')
    report.push(`| nx.json exists | ${checks.nxJsonExists ? '✅' : '❌'} |\n`)
    report.push(`| package.json exists | ${checks.packageJsonExists ? '✅' : '❌'} |\n`)
    report.push(`| libs/ directory | ${checks.libsExist ? '✅' : '❌'} |\n`)
    report.push(`| apps/ directory | ${checks.appsExist ? '✅' : '❌'} |\n\n`)
  }

  if (results.actInstalled !== undefined) {
    report.push('### Act Installation\n')
    report.push(`${results.actInstalled ? '✅' : '❌'} act is ${results.actInstalled ? '' : 'not '}installed\n\n`)
  }

  // Generation results
  report.push('## PipeCraft Generation\n')

  if (results.generation1) {
    report.push('### Initial Generation\n')
    const { success, duration, error } = results.generation1

    report.push(`- **Status:** ${success ? '✅ Success' : '❌ Failed'}\n`)
    report.push(`- **Duration:** ${duration}ms\n`)

    if (error) {
      report.push(`- **Error:** \`${error}\`\n`)
    }

    report.push('\n')
  }

  if (results.generation2) {
    report.push('### Regeneration (Idempotency Test)\n')
    const { success, duration, error } = results.generation2

    report.push(`- **Status:** ${success ? '✅ Success' : '❌ Failed'}\n`)
    report.push(`- **Duration:** ${duration}ms\n`)

    if (error) {
      report.push(`- **Error:** \`${error}\`\n`)
    }

    report.push('\n')
  }

  // Custom job preservation
  if (results.customJobResults) {
    report.push('## Custom Job Preservation\n')

    const { preserved, missing, allPreserved } = results.customJobResults

    report.push(`**Status:** ${allPreserved ? '✅ All jobs preserved' : '❌ Some jobs lost'}\n\n`)

    if (preserved.length > 0) {
      report.push('### Preserved Jobs\n')
      for (const job of preserved) {
        report.push(`- ✅ ${job}\n`)
      }
      report.push('\n')
    }

    if (missing.length > 0) {
      report.push('### Missing Jobs\n')
      for (const job of missing) {
        report.push(`- ❌ ${job}\n`)
      }
      report.push('\n')
    }
  }

  // Act scenario results
  if (results.scenarioResults) {
    report.push('## Act Test Scenarios\n')

    const { results: scenarioResults, passedCount, failedCount, totalCount } = results.scenarioResults

    report.push(`**Summary:** ${passedCount}/${totalCount} scenarios passed\n\n`)

    report.push('| Scenario | Status | Affected Projects | Jobs Run |\n')
    report.push('|----------|--------|-------------------|----------|\n')

    for (const scenario of scenarioResults) {
      const status = scenario.success ? '✅' : '❌'
      const affected = scenario.affected?.join(', ') || 'none'
      const jobsRun = scenario.jobResults?.length || 0

      report.push(`| ${scenario.name} | ${status} | ${affected} | ${jobsRun} |\n`)
    }

    report.push('\n')

    // Detailed scenario results
    report.push('### Detailed Scenario Results\n\n')

    for (const scenario of scenarioResults) {
      report.push(`#### ${scenario.name}\n`)
      report.push(`**Description:** ${scenario.description}\n\n`)
      report.push(`**Status:** ${scenario.success ? '✅ Passed' : '❌ Failed'}\n\n`)

      report.push('**Changes:**\n')
      for (const change of scenario.changes) {
        report.push(`- \`${change}\`\n`)
      }
      report.push('\n')

      if (scenario.affected) {
        report.push('**Affected Projects:**\n')
        for (const project of scenario.affected) {
          report.push(`- ${project}\n`)
        }
        report.push('\n')
      }

      if (scenario.missingProjects && scenario.missingProjects.length > 0) {
        report.push('**Missing Expected Projects:**\n')
        for (const project of scenario.missingProjects) {
          report.push(`- ❌ ${project}\n`)
        }
        report.push('\n')
      }

      if (scenario.unexpectedProjects && scenario.unexpectedProjects.length > 0) {
        report.push('**Unexpected Projects:**\n')
        for (const project of scenario.unexpectedProjects) {
          report.push(`- ⚠️  ${project}\n`)
        }
        report.push('\n')
      }

      if (scenario.jobResults) {
        report.push('**Job Results:**\n')
        report.push('| Job | Status | Duration |\n')
        report.push('|-----|--------|----------|\n')

        for (const job of scenario.jobResults) {
          const status = job.success ? '✅' : '❌'
          report.push(`| ${job.job} | ${status} | ${job.duration}ms |\n`)
        }
        report.push('\n')
      }

      if (scenario.error) {
        report.push(`**Error:** \`${scenario.error}\`\n\n`)
      }

      report.push('---\n\n')
    }
  }

  // Overall summary
  report.push('## Overall Summary\n')

  const allChecks = []

  if (results.nxSetup) {
    allChecks.push({ name: 'Nx Setup', passed: results.nxSetup.success })
  }

  if (results.generation1) {
    allChecks.push({ name: 'Initial Generation', passed: results.generation1.success })
  }

  if (results.generation2) {
    allChecks.push({ name: 'Regeneration', passed: results.generation2.success })
  }

  if (results.customJobResults) {
    allChecks.push({ name: 'Custom Job Preservation', passed: results.customJobResults.allPreserved })
  }

  if (results.scenarioResults) {
    allChecks.push({ name: 'Act Scenarios', passed: results.scenarioResults.allPassed })
  }

  const passedChecks = allChecks.filter(c => c.passed).length
  const totalChecks = allChecks.length

  report.push(`**Result:** ${passedChecks}/${totalChecks} checks passed\n\n`)

  report.push('| Check | Status |\n')
  report.push('|-------|--------|\n')

  for (const check of allChecks) {
    report.push(`| ${check.name} | ${check.passed ? '✅ Passed' : '❌ Failed'} |\n`)
  }

  report.push('\n')

  const allPassed = passedChecks === totalChecks

  if (allPassed) {
    report.push('## 🎉 All Tests Passed!\n')
    report.push('PipeCraft successfully handled the complex Nx monorepo with task dependencies.\n')
  } else {
    report.push('## ⚠️  Some Tests Failed\n')
    report.push('Review the detailed results above to identify issues.\n')
  }

  const reportContent = report.join('')

  await fs.writeFile(outputPath, reportContent)

  console.log(`✅ Test report generated: ${outputPath}`)

  return { reportPath: outputPath, allPassed }
}

export async function generateSummary(results) {
  console.log('\n' + '='.repeat(60))
  console.log('TEST SUMMARY')
  console.log('='.repeat(60))

  const checks = []

  if (results.nxSetup) {
    const status = results.nxSetup.success ? '✅' : '❌'
    console.log(`${status} Nx Setup: ${results.nxSetup.success ? 'Passed' : 'Failed'}`)
    checks.push(results.nxSetup.success)
  }

  if (results.generation1) {
    const status = results.generation1.success ? '✅' : '❌'
    console.log(`${status} Initial Generation: ${results.generation1.success ? 'Passed' : 'Failed'} (${results.generation1.duration}ms)`)
    checks.push(results.generation1.success)
  }

  if (results.generation2) {
    const status = results.generation2.success ? '✅' : '❌'
    console.log(`${status} Regeneration: ${results.generation2.success ? 'Passed' : 'Failed'} (${results.generation2.duration}ms)`)
    checks.push(results.generation2.success)
  }

  if (results.customJobResults) {
    const status = results.customJobResults.allPreserved ? '✅' : '❌'
    console.log(`${status} Custom Job Preservation: ${results.customJobResults.allPreserved ? 'All preserved' : 'Some lost'}`)
    console.log(`   Preserved: ${results.customJobResults.preserved.length}`)
    console.log(`   Missing: ${results.customJobResults.missing.length}`)
    checks.push(results.customJobResults.allPreserved)
  }

  if (results.scenarioResults) {
    const status = results.scenarioResults.allPassed ? '✅' : '❌'
    console.log(`${status} Act Scenarios: ${results.scenarioResults.passedCount}/${results.scenarioResults.totalCount} passed`)
    checks.push(results.scenarioResults.allPassed)
  }

  console.log('='.repeat(60))

  const allPassed = checks.every(Boolean)
  const passedCount = checks.filter(Boolean).length

  if (allPassed) {
    console.log(`🎉 ALL TESTS PASSED (${passedCount}/${checks.length})`)
  } else {
    console.log(`⚠️  SOME TESTS FAILED (${passedCount}/${checks.length} passed)`)
  }

  console.log('='.repeat(60) + '\n')

  return allPassed
}

export async function generateDiffReport(workflow1Path, workflow2Path, outputPath = 'DIFF-REPORT.md') {
  console.log('📊 Generating diff report...')

  const content1 = await fs.readFile(workflow1Path, 'utf8')
  const content2 = await fs.readFile(workflow2Path, 'utf8')

  const report = []

  report.push('# Workflow Diff Report\n\n')
  report.push(`**Workflow 1:** ${workflow1Path}\n`)
  report.push(`**Workflow 2:** ${workflow2Path}\n`)
  report.push(`**Generated:** ${new Date().toISOString()}\n\n`)
  report.push('---\n\n')

  report.push('## Workflow 1\n\n')
  report.push('```yaml\n')
  report.push(content1)
  report.push('```\n\n')

  report.push('## Workflow 2\n\n')
  report.push('```yaml\n')
  report.push(content2)
  report.push('```\n\n')

  const reportContent = report.join('')

  await fs.writeFile(outputPath, reportContent)

  console.log(`✅ Diff report generated: ${outputPath}`)

  return { reportPath: outputPath }
}
