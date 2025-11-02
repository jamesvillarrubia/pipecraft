# utils/ast-path-operations

## Interfaces

### PathOperationConfig

Defined in: [utils/ast-path-operations.ts:127](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L127)

Configuration for a single path operation

PathOperationConfig

#### Example

```typescript
const config: PathOperationConfig = {
  path: 'on.workflow_call.inputs.version',
  operation: 'set',
  value: {
    description: 'The version to deploy',
    required: false,
    type: 'string'
  },
  required: true
}
```

#### Properties

##### comment?

```ts
optional comment: string;
```

Defined in: [utils/ast-path-operations.ts:133](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L133)

##### commentBefore?

```ts
optional commentBefore: string;
```

Defined in: [utils/ast-path-operations.ts:132](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L132)

##### operation

```ts
operation: PathOperation
```

Defined in: [utils/ast-path-operations.ts:129](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L129)

Type of operation to perform

##### path

```ts
path: string
```

Defined in: [utils/ast-path-operations.ts:128](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L128)

Dot-notation path to target (e.g., 'jobs.changes.steps')

##### required?

```ts
optional required: boolean;
```

Defined in: [utils/ast-path-operations.ts:131](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L131)

Whether the path must exist

##### spaceBefore?

```ts
optional spaceBefore: boolean;
```

Defined in: [utils/ast-path-operations.ts:134](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L134)

##### spaceBeforeComment?

```ts
optional spaceBeforeComment: boolean;
```

Defined in: [utils/ast-path-operations.ts:135](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L135)

##### tag?

```ts
optional tag: string;
```

Defined in: [utils/ast-path-operations.ts:136](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L136)

##### value

```ts
value: PathValue
```

Defined in: [utils/ast-path-operations.ts:130](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L130)

Value to set/merge/overwrite

## Type Aliases

### PathOperation

```ts
type PathOperation = 'set' | 'merge' | 'overwrite' | 'preserve'
```

Defined in: [utils/ast-path-operations.ts:93](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L93)

Available operation types for path-based AST manipulation

---

### PathValue

```ts
type PathValue = Node | object | string | number | boolean | any[]
```

Defined in: [utils/ast-path-operations.ts:102](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L102)

Supported value types for path operations

## Functions

### applyPathOperations()

```ts
function applyPathOperations(doc, operations, document?): void
```

Defined in: [utils/ast-path-operations.ts:485](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L485)

Apply multiple path operations to a document

This is the main entry point for applying multiple operations to a YAML document.
It processes all operations in order and applies them to the document.

#### Parameters

##### doc

`YAMLMap`

The YAML document to modify

##### operations

[`PathOperationConfig`](#pathoperationconfig)[]

Array of operations to apply

##### document?

`any`

#### Returns

`void`

#### Example

```typescript
const operations: PathOperationConfig[] = [
  {
    path: 'on.workflow_call.inputs.version',
    operation: 'set',
    value: { description: 'Version to deploy', required: false, type: 'string' }
  },
  {
    path: 'jobs.changes',
    operation: 'overwrite',
    value: createValueFromString(`
      runs-on: ubuntu-latest
      steps:
        - uses: ./actions/detect-changes
    `)
  }
]

applyPathOperations(doc, operations)
```

---

### createValueFromArray()

```ts
function createValueFromArray(arr): Node
```

Defined in: [utils/ast-path-operations.ts:588](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L588)

Create a YAML node from a JavaScript array

Converts a JavaScript array to a YAML sequence node.

#### Parameters

##### arr

`any`[]

JavaScript array to convert

#### Returns

`Node`

The converted YAML sequence node

#### Example

```typescript
const node = createValueFromArray(['develop', 'staging', 'main'])
```

---

### createValueFromObject()

```ts
function createValueFromObject(obj, doc?): Node
```

Defined in: [utils/ast-path-operations.ts:568](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L568)

Create a YAML node from a JavaScript object

Converts a plain JavaScript object to a YAML map node.

#### Parameters

##### obj

`object`

JavaScript object to convert

##### doc?

`any`

#### Returns

`Node`

The converted YAML map node

#### Example

```typescript
const node = createValueFromObject({
  description: 'The version to deploy',
  required: false,
  type: 'string'
})
```

---

### createValueFromString()

```ts
function createValueFromString(yamlString, context?, document?): Node
```

Defined in: [utils/ast-path-operations.ts:523](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L523)

Create a YAML node from a YAML string

Parses a YAML string and returns the root node. This is useful for complex
multi-line YAML structures like job definitions.

#### Parameters

##### yamlString

`string`

YAML string to parse

##### context?

`any`

##### document?

`any`

#### Returns

`Node`

The parsed YAML node

#### Example

```typescript
const node = createValueFromString(`
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v3
    - name: Run tests
      run: npm test
`)
```

---

### ensurePathAndApply()

```ts
function ensurePathAndApply(doc, config, document?): void
```

Defined in: [utils/ast-path-operations.ts:287](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L287)

Ensure a path exists and apply the specified operation

This is the main orchestration function that handles all path operations.
It checks if the path exists, applies the appropriate operation based on
the configuration, and handles required vs optional paths.

#### Parameters

##### doc

`YAMLMap`

The YAML document to modify

##### config

[`PathOperationConfig`](#pathoperationconfig)

Operation configuration

##### document?

`any`

#### Returns

`void`

#### Example

```typescript
const config: PathOperationConfig = {
  path: 'jobs.changes.runs-on',
  operation: 'set',
  value: 'ubuntu-latest',
  required: true
}

ensurePathAndApply(doc, config)
```

---

### getPathValue()

```ts
function getPathValue(doc, path): Node | null
```

Defined in: [utils/ast-path-operations.ts:249](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L249)

Get a value at a specific path in the YAML AST

Navigates to the specified path and returns the node if found, null otherwise.
This is useful for checking if a path exists before applying operations.

#### Parameters

##### doc

`YAMLMap`

The YAML document to read from

##### path

`string`

Dot-notation path (e.g., 'jobs.changes.steps')

#### Returns

`Node` \| `null`

The node at the path, or null if not found

#### Example

```typescript
const doc = parseDocument('jobs: { changes: { runs-on: ubuntu-latest } }')
const value = getPathValue(doc.contents, 'jobs.changes.runs-on')
console.log(value) // Scalar('ubuntu-latest')
```

---

### setPathValue()

```ts
function setPathValue(doc, path, value, document?, commentBefore?, spaceBeforeComment?): void
```

Defined in: [utils/ast-path-operations.ts:158](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/ast-path-operations.ts#L158)

Set a value at a specific path in the YAML AST

Creates intermediate nodes as needed and sets the final value at the specified path.
This is the core function for setting values in the YAML structure.

#### Parameters

##### doc

`YAMLMap`

The YAML document to modify

##### path

`string`

Dot-notation path (e.g., 'jobs.changes.steps')

##### value

[`PathValue`](#pathvalue)

Value to set at the path

##### document?

`any`

##### commentBefore?

`string`

##### spaceBeforeComment?

`boolean`

#### Returns

`void`

#### Throws

When path navigation fails or parent is not a map

#### Example

```typescript
const doc = parseDocument('name: Pipeline')
setPathValue(doc.contents, 'jobs.changes.runs-on', 'ubuntu-latest')
// Results in: jobs: { changes: { 'runs-on': 'ubuntu-latest' } }
```
