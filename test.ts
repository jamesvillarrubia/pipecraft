import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { parseDocument, stringify } from 'yaml'
import fs from 'fs'
import { 
  ensureWorkflowInputs, 
  applyPathOperations, 
  PathOperationConfig,
  createValueFromString,
  createValueFromObject,
  createValueFromArray,
  setPathValue
} from './src/utils/ast-path-operations'
import dedent from 'dedent';



const test = `
  # =============================================================================
  # VERSIONING
  # =============================================================================
  if: github.ref_name == 'main'
  needs: changes
  runs-on: ubuntu-latest
  steps:
    - uses: ./.github/actions/calculate-version
      with:
        baseRef: \${{ inputs.baseRef || 'main' }}
`

console.log('=== Test 1: Basic YAML parsing ===')
let parsed = parseDocument(test)
let result = stringify(parsed)
console.log(result)

console.log('\n=== Test 2: Simulating template generation ===')
// Create a base document
const baseDoc = parseDocument(`
name: "Pipeline"
jobs:
  existing-job:
    runs-on: ubuntu-latest
`)

console.log('Base document:')
console.log(stringify(baseDoc))

// Create a node using createValueFromString
const newNode = createValueFromString(test)
console.log('\nNew node created with createValueFromString:')
console.log(stringify(newNode))
console.log('\nNode type:', typeof newNode)
console.log('Node has type property:', 'type' in newNode)
console.log('Node properties:', Object.keys(newNode))

// Insert the node into the document
const jobsNode = baseDoc.get('jobs')
if (jobsNode && jobsNode.set) {
  jobsNode.set('version', newNode)
  console.log('\nAfter inserting node:')
  console.log(stringify(baseDoc))
} else {
  console.log('Could not find jobs node')
}

console.log('\n=== Test 3: Using setPathValue function ===')
// Create another base document
const baseDoc2 = parseDocument(`
name: "Pipeline"
jobs:
  existing-job:
    runs-on: ubuntu-latest
`)

console.log('Base document 2:')
console.log(stringify(baseDoc2))

// Use setPathValue to insert the node
setPathValue(baseDoc2.contents, 'jobs.version', newNode)
console.log('\nAfter using setPathValue:')
console.log(stringify(baseDoc2))

console.log('\n=== Test 4: Using createValueFromObject with document ===')
// Create another base document
const baseDoc3 = parseDocument(`
name: "Pipeline"
jobs:
  existing-job:
    runs-on: ubuntu-latest
`)

console.log('Base document 3:')
console.log(stringify(baseDoc3))

// Create a node using createValueFromObject with document
const newNode2 = createValueFromObject({
  'runs-on': 'ubuntu-latest',
  steps: [
    {
      uses: './.github/actions/calculate-version',
      with: {
        baseRef: '\${{ inputs.baseRef || main }}'
      }
    }
  ]
}, baseDoc3)

console.log('\nNew node created with createValueFromObject:')
console.log(stringify(newNode2))

// Use setPathValue to insert the node
setPathValue(baseDoc3.contents, 'jobs.version', newNode2)
console.log('\nAfter using setPathValue with createValueFromObject:')
console.log(stringify(baseDoc3))

console.log('\n=== Test 5: Simulating exact template approach ===')
// Create a base document like the template does
const baseDoc4 = parseDocument(`
name: "Pipeline"
jobs:
  existing-job:
    runs-on: ubuntu-latest
`)

console.log('Base document 4:')
console.log(stringify(baseDoc4))

// Create operations array like the template does
const operations: PathOperationConfig[] = [
  {
    path: 'jobs.changes',
    operation: 'overwrite',
    value: createValueFromObject({
      'runs-on': 'ubuntu-latest',
      steps: [
        {
          uses: './.github/actions/detect-changes',
          with: {
            baseRef: '\${{ inputs.baseRef || main }}'
          }
        }
      ]
    }, baseDoc4),
    required: true
  }
]

console.log('\nOperations array created')

// Apply operations like the template does
applyPathOperations(baseDoc4.contents, operations, baseDoc4)
console.log('\nAfter applying operations:')
console.log(stringify(baseDoc4))