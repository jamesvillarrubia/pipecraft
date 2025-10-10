# AST Path Operations for YAML Manipulation

A powerful and precise library for manipulating YAML documents using path-based operations. This library allows you to target specific locations in YAML structures and apply different types of operations with full TypeScript support.

## 🚀 Quick Start

```typescript
import { applyPathOperations, createValueFromString } from './ast-path-operations'
import { parseDocument } from 'yaml'

// Create a YAML document
const doc = parseDocument(`
name: "Pipeline"
on:
  pull_request:
    branches: [main]
`)

// Define operations
const operations = [
  {
    path: 'on.workflow_call.inputs.version',
    operation: 'set',
    value: {
      description: 'The version to deploy',
      required: false,
      type: 'string'
    }
  }
]

// Apply operations
applyPathOperations(doc.contents, operations)
```

## 📋 Table of Contents

- [Features](#features)
- [Operation Types](#operation-types)
- [Value Types](#value-types)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)

## ✨ Features

- **🎯 Path-based targeting**: Use dot notation to target specific YAML paths
- **🔧 Multiple operation types**: Set, merge, overwrite, or preserve values
- **📦 Flexible value types**: Support objects, arrays, strings, YAML nodes, and parsed documents
- **🛡️ Type safety**: Full TypeScript support with proper Node types
- **⚡ Context injection**: Dynamic values can be injected at build time
- **🔄 Intelligent merging**: Smart merge logic for objects and arrays

## 🔧 Operation Types

### `set`
Set a value at the specified path (creates if doesn't exist)

```typescript
{
  path: 'jobs.changes.runs-on',
  operation: 'set',
  value: 'ubuntu-latest'
}
```

### `merge`
Merge with existing value (for objects/arrays)

```typescript
{
  path: 'on.pull_request.branches',
  operation: 'merge',
  value: ['develop', 'staging', 'main']
}
```

### `overwrite`
Replace existing value completely

```typescript
{
  path: 'jobs.changes',
  operation: 'overwrite',
  value: createValueFromString(`
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
  `)
}
```

### `preserve`
Keep existing value, ignore template value

```typescript
{
  path: 'jobs.user-custom-job',
  operation: 'preserve',
  value: null // This will be ignored
}
```

## 📦 Value Types

### Objects
Simple key-value pairs for configuration

```typescript
{
  path: 'on.workflow_call.inputs.version',
  operation: 'set',
  value: {
    description: 'The version to deploy',
    required: false,
    type: 'string'
  }
}
```

### Arrays
Simple arrays for lists

```typescript
{
  path: 'on.pull_request.branches',
  operation: 'merge',
  value: ['develop', 'staging', 'main']
}
```

### YAML Strings
Multi-line YAML with proper formatting

```typescript
{
  path: 'jobs.changes',
  operation: 'overwrite',
  value: createValueFromString(`
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/detect-changes
        with:
          baseRef: \${{ inputs.baseRef || 'main' }}
  `)
}
```

### Parsed Documents
Pre-parsed YAML nodes

```typescript
const parsedJob = parseDocument(`
  runs-on: ubuntu-latest
  steps:
    - name: Example step
      run: echo "Hello"
`)

{
  path: 'jobs.example',
  operation: 'set',
  value: parsedJob.contents
}
```

## 📚 API Reference

### Core Functions

#### `applyPathOperations(doc, operations)`
Apply multiple path operations to a document

**Parameters:**
- `doc: YAMLMap` - The YAML document to modify
- `operations: PathOperationConfig[]` - Array of operations to apply

#### `setPathValue(doc, path, value)`
Set a value at a specific path in the YAML AST

**Parameters:**
- `doc: YAMLMap` - The YAML document to modify
- `path: string` - Dot-notation path (e.g., 'jobs.changes.steps')
- `value: PathValue` - Value to set at the path

#### `getPathValue(doc, path)`
Get a value at a specific path in the YAML AST

**Parameters:**
- `doc: YAMLMap` - The YAML document to read from
- `path: string` - Dot-notation path (e.g., 'jobs.changes.steps')
- **Returns:** `Node | null` - The node at the path, or null if not found

### Helper Functions

#### `createValueFromString(yamlString)`
Create a YAML node from a YAML string

#### `createValueFromObject(obj)`
Create a YAML node from a JavaScript object

#### `createValueFromArray(arr)`
Create a YAML node from a JavaScript array

## 💡 Examples

### Basic Workflow Configuration

```typescript
import { applyPathOperations, createValueFromString } from './ast-path-operations'
import { parseDocument } from 'yaml'

const doc = parseDocument('name: "Pipeline"')

const operations = [
  // Set workflow inputs
  {
    path: 'on.workflow_call.inputs.version',
    operation: 'set',
    value: {
      description: 'The version to deploy',
      required: false,
      type: 'string'
    }
  },
  
  // Merge branch list
  {
    path: 'on.pull_request.branches',
    operation: 'merge',
    value: ['develop', 'staging', 'main']
  },
  
  // Overwrite job definition
  {
    path: 'jobs.changes',
    operation: 'overwrite',
    value: createValueFromString(`
      runs-on: ubuntu-latest
      steps:
        - uses: ./.github/actions/detect-changes
          with:
            baseRef: \${{ inputs.baseRef || 'main' }}
    `)
  }
]

applyPathOperations(doc.contents, operations)
```

### Complex Job Definitions

```typescript
const jobOperations = [
  {
    path: 'jobs.test',
    operation: 'overwrite',
    value: createValueFromString(`
      runs-on: ubuntu-latest
      needs: changes
      steps:
        - name: Checkout code
          uses: actions/checkout@v3
        - name: Setup Node.js
          uses: actions/setup-node@v3
          with:
            node-version: '18'
        - name: Install dependencies
          run: npm ci
        - name: Run tests
          run: npm test
    `)
  }
]
```

### Preserving User Customizations

```typescript
const operations = [
  // Template-managed (always updated)
  {
    path: 'jobs.changes',
    operation: 'overwrite',
    value: createValueFromString(`...`) // Latest template
  },
  
  // User-managed (preserved)
  {
    path: 'jobs.user-tests',
    operation: 'preserve',
    value: null // User's customizations kept
  }
]
```

## 🎯 Best Practices

### 1. Use Appropriate Value Types

**✅ Good:**
```typescript
// Simple objects for configuration
{ path: 'on.workflow_call.inputs.version', value: { description: '...', type: 'string' } }

// YAML strings for complex structures
{ path: 'jobs.changes', value: createValueFromString(`runs-on: ubuntu-latest\nsteps: ...`) }
```

**❌ Avoid:**
```typescript
// Don't use YAML strings for simple values
{ path: 'jobs.changes.runs-on', value: createValueFromString('ubuntu-latest') }
```

### 2. Choose the Right Operation

- **`set`**: For required configuration that must exist
- **`merge`**: For arrays/lists where you want to add items
- **`overwrite`**: For template-managed sections that should get updates
- **`preserve`**: For user-managed sections that should keep customizations

### 3. Organize Operations by Purpose

```typescript
const operations = [
  // 1. Ensure required inputs exist
  { path: 'on.workflow_call.inputs.version', operation: 'set', value: {...} },
  
  // 2. Merge configuration
  { path: 'on.pull_request.branches', operation: 'merge', value: [...] },
  
  // 3. Overwrite template-managed jobs
  { path: 'jobs.changes', operation: 'overwrite', value: createValueFromString(...) },
  
  // 4. Preserve user sections
  { path: 'jobs.user-tests', operation: 'preserve', value: null }
]
```

### 4. Use Context Injection

```typescript
const operations = [
  {
    path: 'jobs.version',
    operation: 'overwrite',
    value: createValueFromString(`
      if: github.ref_name == '${ctx.initialBranch || 'develop'}'
      needs: changes
      runs-on: ubuntu-latest
    `)
  }
]
```

## 🔍 Troubleshooting

### Common Issues

**Path not found errors:**
- Ensure the path exists or use `required: false`
- Check for typos in dot notation paths

**Type errors:**
- Use proper TypeScript types for Node values
- Cast parsed documents correctly

**Merge conflicts:**
- Use `overwrite` for template-managed sections
- Use `preserve` for user-managed sections

### Debug Tips

```typescript
// Check if path exists before applying
const existingValue = getPathValue(doc, 'jobs.changes')
if (existingValue) {
  console.log('Path exists:', stringify(existingValue))
}

// Use console.log to debug operations
console.log('Applying operation:', operation)
applyPathOperations(doc, [operation])
console.log('Result:', stringify(doc))
```

## 📄 License

This library is part of the Flowcraft project and follows the same licensing terms.
