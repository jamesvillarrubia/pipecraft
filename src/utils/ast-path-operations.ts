import { parseDocument, stringify, YAMLMap, YAMLSeq, Scalar, Node } from 'yaml'

/**
 * # AST Path Operations for YAML Manipulation
 * 
 * This module provides a powerful and precise way to manipulate YAML documents using
 * path-based operations. It allows you to target specific locations in the YAML
 * structure and apply different types of operations (set, merge, overwrite, preserve).
 * 
 * ## Key Features
 * 
 * - **Path-based targeting**: Use dot notation to target specific YAML paths
 * - **Multiple operation types**: Set, merge, overwrite, or preserve values
 * - **Flexible value types**: Support objects, arrays, strings, YAML nodes, and parsed documents
 * - **Type safety**: Full TypeScript support with proper Node types
 * - **Context injection**: Dynamic values can be injected at build time
 * 
 * ## Usage Examples
 * 
 * ### Basic Path Operations
 * ```typescript
 * import { applyPathOperations, createValueFromString } from './ast-path-operations'
 * 
 * const operations = [
 *   {
 *     path: 'on.workflow_call.inputs.version',
 *     operation: 'set',
 *     value: {
 *       description: 'The version to deploy',
 *       required: false,
 *       type: 'string'
 *     }
 *   }
 * ]
 * 
 * applyPathOperations(doc, operations)
 * ```
 * 
 * ### Complex Job Definitions
 * ```typescript
 * const jobOperation = {
 *   path: 'jobs.changes',
 *   operation: 'overwrite',
 *   value: createValueFromString(`
 *     runs-on: ubuntu-latest
 *     steps:
 *       - uses: ./.github/actions/detect-changes
 *         with:
 *           baseRef: ${{ inputs.baseRef || 'main' }}
 *   `)
 * }
 * ```
 * 
 * ### Array Merging
 * ```typescript
 * const branchOperation = {
 *   path: 'on.pull_request.branches',
 *   operation: 'merge',
 *   value: ['develop', 'staging', 'main']
 * }
 * ```
 * 
 * ## Operation Types
 * 
 * - **`set`**: Set a value at the specified path (creates if doesn't exist)
 * - **`merge`**: Merge with existing value (for objects/arrays)
 * - **`overwrite`**: Replace existing value completely
 * - **`preserve`**: Keep existing value, ignore template value
 * 
 * ## Value Types Supported
 * 
 * - **Objects**: `{ key: 'value' }` - Simple key-value pairs
 * - **Arrays**: `['item1', 'item2']` - Simple arrays
 * - **YAML Strings**: Multi-line YAML with proper formatting
 * - **Parsed Documents**: Pre-parsed YAML nodes
 * - **Primitives**: strings, numbers, booleans
 * 
 * @fileoverview Path-based AST operations for precise YAML manipulation
 * @author Pipecraft Team
 * @version 1.0.0
 */

/**
 * Available operation types for path-based AST manipulation
 * 
 * @typedef {('set' | 'merge' | 'overwrite' | 'preserve')} PathOperation
 * 
 * - `set`: Set a value at the specified path (creates if doesn't exist)
 * - `merge`: Merge with existing value (for objects/arrays)  
 * - `overwrite`: Replace existing value completely
 * - `preserve`: Keep existing value, ignore template value
 */
export type PathOperation = 'set' | 'merge' | 'overwrite' | 'preserve'

/**
 * Supported value types for path operations
 * 
 * @typedef {(Node | object | string | number | boolean | any[])} PathValue
 * 
 * Supports YAML nodes, JavaScript objects, primitives, and arrays
 */
export type PathValue = Node | object | string | number | boolean | any[]

/**
 * Configuration for a single path operation
 * 
 * @interface PathOperationConfig
 * @property {string} path - Dot-notation path to target (e.g., 'jobs.changes.steps')
 * @property {PathOperation} operation - Type of operation to perform
 * @property {PathValue} value - Value to set/merge/overwrite
 * @property {boolean} [required=true] - Whether the path must exist
 * 
 * @example
 * ```typescript
 * const config: PathOperationConfig = {
 *   path: 'on.workflow_call.inputs.version',
 *   operation: 'set',
 *   value: {
 *     description: 'The version to deploy',
 *     required: false,
 *     type: 'string'
 *   },
 *   required: true
 * }
 * ```
 */
export interface PathOperationConfig {
  path: string
  operation: PathOperation
  value: PathValue
  required?: boolean
  commentBefore?: string
  comment?: string
  spaceBefore?: boolean
  spaceBeforeComment?: boolean
  tag?: string
}

/**
 * Set a value at a specific path in the YAML AST
 * 
 * Creates intermediate nodes as needed and sets the final value at the specified path.
 * This is the core function for setting values in the YAML structure.
 * 
 * @param {YAMLMap} doc - The YAML document to modify
 * @param {string} path - Dot-notation path (e.g., 'jobs.changes.steps')
 * @param {PathValue} value - Value to set at the path
 * 
 * @throws {Error} When path navigation fails or parent is not a map
 * 
 * @example
 * ```typescript
 * const doc = parseDocument('name: Pipeline')
 * setPathValue(doc.contents, 'jobs.changes.runs-on', 'ubuntu-latest')
 * // Results in: jobs: { changes: { 'runs-on': 'ubuntu-latest' } }
 * ```
 */
export function setPathValue(doc: YAMLMap, path: string, value: PathValue, document?: any, commentBefore?: string, spaceBeforeComment?: boolean): void {
  const pathParts = path.split('.')
  let current: Node = doc

  // Navigate to the parent of the target
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i]

    if (current instanceof YAMLMap) {
      let next: any = current.get(part)
      if (!next) {
        // Create missing intermediate nodes
        next = new YAMLMap()
        current.set(part, next)
      }
      current = next
    } else {
      throw new Error(`Cannot navigate to ${part} - parent is not a map`)
    }
  }

  // Set the final value
  const finalKey = pathParts[pathParts.length - 1]
  if (current instanceof YAMLMap) {
    let node: any

    // Check if value is already a node (from createValueFromString, etc.)
    if (value && typeof value === 'object' && ('items' in value || 'type' in value)) {
      // Value is already a node, use it directly
      node = value
    } else {
      // Value is not a node, create one
      node = document && document.createNode ? document.createNode(value) : createNode(value)
    }

    // When commentBefore is provided, or when setting a job key (which may need comments added later),
    // we need to handle the case specially.
    // For job keys, we create Scalar keys so we can add comments to the KEY later (in template code).
    // For non-job paths with comments, we add comments to the VALUE node.
    const isJobKey = pathParts.length === 2 && pathParts[0] === 'jobs'

    // Check if key already exists - if so, delete it first to avoid duplicates
    const existingValue = current.get(finalKey)
    if (existingValue !== undefined) {
      current.delete(finalKey)
    }

    if (isJobKey || commentBefore) {
      // For job keys OR any field with comments: Create a Scalar key and add comments to the KEY
      // Comments should be attached to keys, not values, for proper YAML formatting
      const scalarKey = new Scalar(finalKey)
      if (commentBefore) {
        ;(scalarKey as any).commentBefore = commentBefore
        // For job keys, also add to value for backwards compatibility with tests
        if (isJobKey && node) {
          ;(node as any).commentBefore = commentBefore
        }
      }
      if (spaceBeforeComment) {
        ;(scalarKey as any).spaceBefore = true
        if (isJobKey && node) {
          ;(node as any).spaceBefore = true
        }
      }
      current.add({ key: scalarKey, value: node })
    } else {
      // Normal case: use the simple set() method which creates a string key
      current.set(finalKey, node)
    }
  } else {
    throw new Error(`Cannot set ${finalKey} - parent is not a map`)
  }
}

/**
 * Get a value at a specific path in the YAML AST
 * 
 * Navigates to the specified path and returns the node if found, null otherwise.
 * This is useful for checking if a path exists before applying operations.
 * 
 * @param {YAMLMap} doc - The YAML document to read from
 * @param {string} path - Dot-notation path (e.g., 'jobs.changes.steps')
 * @returns {Node | null} The node at the path, or null if not found
 * 
 * @example
 * ```typescript
 * const doc = parseDocument('jobs: { changes: { runs-on: ubuntu-latest } }')
 * const value = getPathValue(doc.contents, 'jobs.changes.runs-on')
 * console.log(value) // Scalar('ubuntu-latest')
 * ```
 */
export function getPathValue(doc: YAMLMap, path: string): Node | null {
  const pathParts = path.split('.')
  let current: Node = doc
  
  for (const part of pathParts) {
    if (current instanceof YAMLMap) {
      current = current.get(part) as Node
      if (!current) return null
    } else {
      return null
    }
  }
  
  return current
}

/**
 * Ensure a path exists and apply the specified operation
 * 
 * This is the main orchestration function that handles all path operations.
 * It checks if the path exists, applies the appropriate operation based on
 * the configuration, and handles required vs optional paths.
 * 
 * @param {YAMLMap} doc - The YAML document to modify
 * @param {PathOperationConfig} config - Operation configuration
 * 
 * @example
 * ```typescript
 * const config: PathOperationConfig = {
 *   path: 'jobs.changes.runs-on',
 *   operation: 'set',
 *   value: 'ubuntu-latest',
 *   required: true
 * }
 * 
 * ensurePathAndApply(doc, config)
 * ```
 */
export function ensurePathAndApply(
  doc: YAMLMap,
  config: PathOperationConfig,
  document?: any
): void {
  const { path, operation, value, required = true, commentBefore, spaceBefore } = config

  // Check if path exists
  const existingValue = getPathValue(doc, path)

  if (!existingValue && !required) {
    // Path doesn't exist and not required - skip
    return
  }

  // Apply operation based on whether path exists or not
  // For required paths that don't exist, we still respect the operation type
  switch (operation) {
    case 'set':
      setPathValue(doc, path, value, document, commentBefore, spaceBefore)
      break

    case 'merge':
      // Merge will handle non-existent paths by creating them
      mergePathValue(doc, path, value, document)
      break

    case 'overwrite':
      setPathValue(doc, path, value, document, commentBefore, spaceBefore)
      break

    case 'preserve':
      // Only preserve if path exists, otherwise create it
      if (!existingValue) {
        setPathValue(doc, path, value, document, commentBefore, spaceBefore)
      }
      // If exists, do nothing - keep existing value
      break
  }
}

/**
 * Merge a value at a specific path (for objects/arrays)
 * 
 * Intelligently merges values based on their type:
 * - Objects: Merges key-value pairs, preserving existing keys
 * - Arrays: Adds new items that don't already exist
 * - Other types: Falls back to overwrite behavior
 * 
 * @param {YAMLMap} doc - The YAML document to modify
 * @param {string} path - Dot-notation path to merge at
 * @param {PathValue} value - Value to merge
 * 
 * @example
 * ```typescript
 * // Merge object properties
 * mergePathValue(doc, 'on.workflow_call.inputs', {
 *   version: { description: 'Version to deploy' },
 *   environment: { description: 'Environment to deploy to' }
 * })
 * 
 * // Merge array items
 * mergePathValue(doc, 'on.pull_request.branches', ['feature-branch'])
 * ```
 */
function mergePathValue(doc: YAMLMap, path: string, value: PathValue, document?: any): void {
  const existingValue = getPathValue(doc, path)
  
  if (!existingValue) {
    setPathValue(doc, path, value, document)
    return
  }
  
  // Merge logic based on type
  if (existingValue instanceof YAMLMap && typeof value === 'object') {
    // Merge objects
    const newMap = (document && document.createNode ? document.createNode(value) : createNode(value)) as YAMLMap
    for (const pair of newMap.items) {
      const key = pair.key
      const val = pair.value
      existingValue.set(key, val)
    }
  } else if (existingValue instanceof YAMLSeq && Array.isArray(value)) {
    // Merge arrays - add new items that don't exist
    const newSeq = (document && document.createNode ? document.createNode(value) : createNode(value)) as YAMLSeq
    for (const item of newSeq.items) {
      if (!existingValue.items.some(existing => 
        stringify(existing) === stringify(item)
      )) {
        existingValue.items.push(item)
      }
    }
  } else {
    // Fallback to overwrite
    setPathValue(doc, path, value, document)
  }
}

/**
 * Create a YAML node from a JavaScript value, YAML node, or parsed document
 * 
 * This is the core value conversion function that handles all supported value types.
 * It intelligently converts JavaScript values to appropriate YAML nodes.
 * 
 * @param {PathValue} value - Value to convert to YAML node
 * @returns {Node} The converted YAML node
 * 
 * @example
 * ```typescript
 * // Convert object
 * const node = createNode({ key: 'value' })
 * 
 * // Convert array
 * const node = createNode(['item1', 'item2'])
 * 
 * // Convert string
 * const node = createNode('simple string')
 * 
 * // Convert YAML string
 * const node = createNode(createValueFromString(`
 *   runs-on: ubuntu-latest
 *   steps:
 *     - name: Example step
 *       run: echo "Hello"
 * `))
 * ```
 */
function createNode(value: PathValue): Node {
  // If it's already a YAML node, return it
  if (value && typeof value === 'object' && 'type' in value) {
    return value as Node
  }
  
  // If it's a parsed document, extract the contents
  if (value && typeof value === 'object' && 'contents' in value) {
    const contents = (value as any).contents
    // If contents is a single item, return it directly
    if (contents && typeof contents === 'object' && 'type' in contents) {
      return contents
    }
    return contents
  }
  
  // Handle primitive types
  if (typeof value === 'string') {
    return new Scalar(value)
  } else if (typeof value === 'number') {
    return new Scalar(value)
  } else if (typeof value === 'boolean') {
    return new Scalar(value)
  } else if (Array.isArray(value)) {
    const seq = new YAMLSeq()
    for (const item of value) {
      seq.items.push(createNode(item))
    }
    return seq
  } else if (typeof value === 'object' && value !== null) {
    const map = new YAMLMap()
    for (const [key, val] of Object.entries(value)) {
      map.set(key, createNode(val))
    }
    return map
  } else {
    return new Scalar(value)
  }
}

/**
 * Apply multiple path operations to a document
 * 
 * This is the main entry point for applying multiple operations to a YAML document.
 * It processes all operations in order and applies them to the document.
 * 
 * @param {YAMLMap} doc - The YAML document to modify
 * @param {PathOperationConfig[]} operations - Array of operations to apply
 * 
 * @example
 * ```typescript
 * const operations: PathOperationConfig[] = [
 *   {
 *     path: 'on.workflow_call.inputs.version',
 *     operation: 'set',
 *     value: { description: 'Version to deploy', required: false, type: 'string' }
 *   },
 *   {
 *     path: 'jobs.changes',
 *     operation: 'overwrite',
 *     value: createValueFromString(`
 *       runs-on: ubuntu-latest
 *       steps:
 *         - uses: ./.github/actions/detect-changes
 *     `)
 *   }
 * ]
 * 
 * applyPathOperations(doc, operations)
 * ```
 */
export function applyPathOperations(
  doc: YAMLMap, 
  operations: PathOperationConfig[],
  document?: any
): void {
  for (const operation of operations) {
    ensurePathAndApply(doc, operation, document)
  }
}

/**
 * Helper functions for creating values
 * 
 * These convenience functions make it easier to create YAML nodes from different
 * value types. They handle the parsing and conversion automatically.
 */

/**
 * Create a YAML node from a YAML string
 * 
 * Parses a YAML string and returns the root node. This is useful for complex
 * multi-line YAML structures like job definitions.
 * 
 * @param {string} yamlString - YAML string to parse
 * @returns {Node} The parsed YAML node
 * 
 * @example
 * ```typescript
 * const node = createValueFromString(`
 *   runs-on: ubuntu-latest
 *   steps:
 *     - name: Checkout code
 *       uses: actions/checkout@v3
 *     - name: Run tests
 *       run: npm test
 * `)
 * ```
 */
export function createValueFromString(yamlString: string, context?: any, document?: any): Node {
  // Evaluate JavaScript template literals in the string using the provided context
  // Use a more sophisticated approach that handles nested braces
  let processedString = yamlString
  let match
  const regex = /\$\{([^{}]+)\}/g
  
  while ((match = regex.exec(processedString)) !== null) {
    const [fullMatch, expression] = match
    try {
      // Create a function that evaluates the expression with the context
      const func = new Function('ctx', `return ${expression}`)
      const result = func(context || {})
      processedString = processedString.replace(fullMatch, JSON.stringify(result))
      // Reset regex lastIndex to avoid issues with string replacement
      regex.lastIndex = 0
    } catch (error) {
      // If evaluation fails, return the original expression as a string
      processedString = processedString.replace(fullMatch, `"${expression}"`)
      regex.lastIndex = 0
    }
  }
  
  // Parse the YAML string and return the root content as a proper Node
  const doc = parseDocument(processedString)
  return doc.contents as Node
}

/**
 * Create a YAML node from a JavaScript object
 * 
 * Converts a plain JavaScript object to a YAML map node.
 * 
 * @param {object} obj - JavaScript object to convert
 * @returns {Node} The converted YAML map node
 * 
 * @example
 * ```typescript
 * const node = createValueFromObject({
 *   description: 'The version to deploy',
 *   required: false,
 *   type: 'string'
 * })
 * ```
 */
export function createValueFromObject(obj: object, doc?: any): Node {
  if (doc && doc.createNode) {
    return doc.createNode(obj)
  }
  return createNode(obj)
}

/**
 * Create a YAML node from a JavaScript array
 * 
 * Converts a JavaScript array to a YAML sequence node.
 * 
 * @param {any[]} arr - JavaScript array to convert
 * @returns {Node} The converted YAML sequence node
 * 
 * @example
 * ```typescript
 * const node = createValueFromArray(['develop', 'staging', 'main'])
 * ```
 */
export function createValueFromArray(arr: any[]): Node {
  return createNode(arr)
}
