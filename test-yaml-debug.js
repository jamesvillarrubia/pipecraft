import { parseDocument, stringify } from 'yaml'
import { readFileSync } from 'fs'

const content = readFileSync('./tests/fixtures/pipeline-preserve-comments.yml', 'utf8')
const doc = parseDocument(content)

console.log('BEFORE: Document commentBefore:', doc.commentBefore ? doc.commentBefore.substring(0, 40) + '...' : 'undefined')

// Clear and rebuild
doc.contents.items = []

console.log('AFTER CLEAR: Document commentBefore:', doc.commentBefore ? doc.commentBefore.substring(0, 40) + '...' : 'undefined')

// Try to set it
doc.commentBefore = '# USER COMMENT 1'

console.log('AFTER SET: Document commentBefore:', doc.commentBefore)

console.log('\nSTRINGIFY OUTPUT:')
console.log(stringify(doc).substring(0, 200))
