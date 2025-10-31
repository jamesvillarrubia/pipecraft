import fs from 'fs'
import { parse, parseDocument, stringify } from 'yaml'

// Parse the pipeline.yml.backup file
const pipelineContent = fs.readFileSync('.github/workflows/pipeline.yml.backup', 'utf8')

// Parse as a document to get the full AST structure
const doc = parseDocument(pipelineContent)

console.log('=== PARSED DOCUMENT AST STRUCTURE ===')
console.log('Document contents AST:', doc.contents)

console.log('\n=== DOCUMENT PROPERTIES ===')
console.log('Directives:', doc.directives)
console.log('Errors:', doc.errors)
console.log('Warnings:', doc.warnings)

console.log('\n=== CONVERTED TO JS OBJECT ===')
const jsObject = doc.toJS()
console.log(JSON.stringify(jsObject, null, 2))

// Save the parsed structure to a file for manipulation
fs.writeFileSync('pipeline-structure.json', JSON.stringify(jsObject, null, 2))
console.log('\n=== SAVED TO pipeline-structure.json ===')

// Test converting back to YAML
const backToYaml = stringify(jsObject, { indent: 2 })
console.log('\n=== CONVERTED BACK TO YAML ===')
console.log(backToYaml)
