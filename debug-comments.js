const { parseDocument, stringify } = require('yaml')

// Test if commentBefore works with the yaml library
const yaml = `
name: "Test"
jobs:
  test-job:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`

const doc = parseDocument(yaml)
const testJob = doc.contents.get('jobs').get('test-job')

console.log('Before setting commentBefore:')
console.log('commentBefore:', testJob.commentBefore)

// Set commentBefore
testJob.commentBefore = `
# =============================================================================
# TEST JOB
# =============================================================================
`

console.log('After setting commentBefore:')
console.log('commentBefore:', testJob.commentBefore)

// Stringify and check output
const output = stringify(doc)
console.log('\nOutput:')
console.log(output)
