#!/usr/bin/env node

/**
 * Test script to compare job order between original and generated pipelines
 * This ensures that Pipecraft jobs maintain their original positions
 */

const fs = require('fs')
const path = require('path')
const yaml = require('yaml')

/**
 * Extract job names in order from a YAML file
 */
function getJobOrder(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    return []
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const doc = yaml.parseDocument(content)

    if (!doc.contents || !doc.contents.get('jobs')) {
      console.error(`❌ No jobs section found in ${filePath}`)
      return []
    }

    const jobsNode = doc.contents.get('jobs')
    if (!jobsNode.items) {
      console.error(`❌ No job items found in ${filePath}`)
      return []
    }

    return jobsNode.items.map(item => item.key.value)
  } catch (error) {
    console.error(`❌ Error parsing ${filePath}:`, error.message)
    return []
  }
}

/**
 * Compare two job orders and report differences
 */
function compareJobOrders(original, generated, testName) {
  console.log(`\n🔍 Testing: ${testName}`)
  console.log(`📋 Original order:  [${original.join(', ')}]`)
  console.log(`📋 Generated order: [${generated.join(', ')}]`)

  if (original.length !== generated.length) {
    console.log(
      `❌ Length mismatch: original has ${original.length} jobs, generated has ${generated.length}`
    )
    return false
  }

  let matches = 0
  const differences = []

  for (let i = 0; i < original.length; i++) {
    if (original[i] === generated[i]) {
      matches++
    } else {
      differences.push({
        position: i,
        original: original[i],
        generated: generated[i]
      })
    }
  }

  if (matches === original.length) {
    console.log(`✅ Perfect match! All ${matches} jobs in correct order`)
    return true
  } else {
    console.log(`❌ ${differences.length} position(s) differ:`)
    differences.forEach(diff => {
      console.log(
        `   Position ${diff.position}: expected "${diff.original}", got "${diff.generated}"`
      )
    })
    return false
  }
}

/**
 * Main test function
 */
function runJobOrderTests() {
  console.log('🧪 Pipecraft Job Order Test Suite')
  console.log('=====================================')

  const testCases = [
    {
      name: 'User Modified Pipeline',
      original: '.github/workflows/pipeline-user-modified.yml',
      generated: '.github/workflows/pipeline-test-order-restored.yml'
    },
    {
      name: 'Final Test Pipeline',
      original: '.github/workflows/pipeline-user-modified.yml',
      generated: '.github/workflows/pipeline-test-final.yml'
    }
  ]

  let allPassed = true

  for (const testCase of testCases) {
    const originalOrder = getJobOrder(testCase.original)
    const generatedOrder = getJobOrder(testCase.generated)

    if (originalOrder.length === 0 || generatedOrder.length === 0) {
      console.log(`❌ Skipping ${testCase.name} - failed to parse files`)
      allPassed = false
      continue
    }

    const passed = compareJobOrders(originalOrder, generatedOrder, testCase.name)
    if (!passed) {
      allPassed = false
    }
  }

  console.log('\n📊 Test Results')
  console.log('================')
  if (allPassed) {
    console.log('✅ All job order tests PASSED!')
    console.log('🎉 Pipecraft jobs are maintaining their original positions')
  } else {
    console.log('❌ Some job order tests FAILED!')
    console.log('🔧 Job positions are not being preserved correctly')
  }

  return allPassed
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const success = runJobOrderTests()
  process.exit(success ? 0 : 1)
}

module.exports = { getJobOrder, compareJobOrders, runJobOrderTests }
