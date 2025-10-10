import { parseDocument, stringify, YAMLMap, YAMLSeq, Scalar, YAMLNode } from 'yaml'

/**
 * Path-based AST operations for YAML manipulation
 * Allows precise control over specific paths in the YAML structure
 */

export type PathOperation = 'set' | 'merge' | 'overwrite' | 'preserve'

export type PathValue = YAMLNode | object | string | number | boolean | any[]

export interface PathOperationConfig {
  path: string
  operation: PathOperation
  value: PathValue
  required?: boolean
}

/**
 * Set a value at a specific path in the YAML AST
 */
export function setPathValue(doc: YAMLMap, path: string, value: PathValue): void {
  const pathParts = path.split('.')
  let current: YAMLNode = doc
  
  // Navigate to the parent of the target
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i]
    
    if (current instanceof YAMLMap) {
      let next = current.get(part)
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
    current.set(finalKey, createYAMLNode(value))
  } else {
    throw new Error(`Cannot set ${finalKey} - parent is not a map`)
  }
}

/**
 * Get a value at a specific path in the YAML AST
 */
export function getPathValue(doc: YAMLMap, path: string): YAMLNode | null {
  const pathParts = path.split('.')
  let current: YAMLNode = doc
  
  for (const part of pathParts) {
    if (current instanceof YAMLMap) {
      current = current.get(part)
      if (!current) return null
    } else {
      return null
    }
  }
  
  return current
}

/**
 * Ensure a path exists and apply the specified operation
 */
export function ensurePathAndApply(
  doc: YAMLMap, 
  config: PathOperationConfig
): void {
  const { path, operation, value, required = true } = config
  
  // Check if path exists
  const existingValue = getPathValue(doc, path)
  
  if (!existingValue && required) {
    // Path doesn't exist and is required - create it
    setPathValue(doc, path, value)
    return
  }
  
  if (!existingValue) {
    // Path doesn't exist and not required - skip
    return
  }
  
  // Path exists - apply operation
  switch (operation) {
    case 'set':
      setPathValue(doc, path, value)
      break
      
    case 'merge':
      mergePathValue(doc, path, value)
      break
      
    case 'overwrite':
      setPathValue(doc, path, value)
      break
      
    case 'preserve':
      // Do nothing - keep existing value
      break
  }
}

/**
 * Merge a value at a specific path (for objects/arrays)
 */
function mergePathValue(doc: YAMLMap, path: string, value: PathValue): void {
  const existingValue = getPathValue(doc, path)
  
  if (!existingValue) {
    setPathValue(doc, path, value)
    return
  }
  
  // Merge logic based on type
  if (existingValue instanceof YAMLMap && typeof value === 'object') {
    // Merge objects
    const newMap = createYAMLNode(value) as YAMLMap
    for (const [key, val] of newMap.items) {
      existingValue.set(key, val)
    }
  } else if (existingValue instanceof YAMLSeq && Array.isArray(value)) {
    // Merge arrays - add new items that don't exist
    const newSeq = createYAMLNode(value) as YAMLSeq
    for (const item of newSeq.items) {
      if (!existingValue.items.some(existing => 
        stringify(existing) === stringify(item)
      )) {
        existingValue.items.push(item)
      }
    }
  } else {
    // Fallback to overwrite
    setPathValue(doc, path, value)
  }
}

/**
 * Create a YAML node from a JavaScript value, YAML node, or parsed document
 */
function createYAMLNode(value: PathValue): YAMLNode {
  // If it's already a YAML node, return it
  if (value instanceof YAMLNode) {
    return value
  }
  
  // If it's a parsed document, extract the contents
  if (value && typeof value === 'object' && 'contents' in value) {
    return (value as any).contents
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
      seq.items.push(createYAMLNode(item))
    }
    return seq
  } else if (typeof value === 'object' && value !== null) {
    const map = new YAMLMap()
    for (const [key, val] of Object.entries(value)) {
      map.set(key, createYAMLNode(val))
    }
    return map
  } else {
    return new Scalar(value)
  }
}

/**
 * Apply multiple path operations to a document
 */
export function applyPathOperations(
  doc: YAMLMap, 
  operations: PathOperationConfig[]
): void {
  for (const operation of operations) {
    ensurePathAndApply(doc, operation)
  }
}

/**
 * Helper functions for creating values
 */
export function createValueFromString(yamlString: string): YAMLNode {
  return parseDocument(yamlString).contents
}

export function createValueFromObject(obj: object): YAMLNode {
  return createYAMLNode(obj)
}

export function createValueFromArray(arr: any[]): YAMLNode {
  return createYAMLNode(arr)
}

/**
 * Example usage for workflow inputs
 */
export function ensureWorkflowInputs(doc: YAMLMap, ctx: any): void {
  const operations: PathOperationConfig[] = [
    // Ensure workflow_call inputs exist and have required fields
    {
      path: 'on.workflow_call.inputs.version',
      operation: 'set',
      value: {
        description: 'The version to deploy',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_call.inputs.baseRef',
      operation: 'set', 
      value: {
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      },
      required: true
    },
    
    // Ensure workflow_dispatch inputs exist and have required fields
    {
      path: 'on.workflow_dispatch.inputs.version',
      operation: 'set',
      value: {
        description: 'The version to deploy',
        required: false,
        type: 'string'
      },
      required: true
    },
    {
      path: 'on.workflow_dispatch.inputs.baseRef',
      operation: 'set',
      value: {
        description: 'The base reference for comparison',
        required: false,
        type: 'string'
      },
      required: true
    },
    
    // Merge branch list (preserve user branches, ensure template branches)
    {
      path: 'on.pull_request.branches',
      operation: 'merge',
      value: ctx.branchFlow || ['develop', 'staging', 'main'],
      required: true
    }
  ]
  
  applyPathOperations(doc, operations)
}
