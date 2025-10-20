[**pipecraft v0.0.0-releaseit**](../README.md)

***

[pipecraft](../README.md) / utils/preflight

# utils/preflight

Pre-Flight Validation Checks

This module implements comprehensive environment validation before workflow generation.
Pre-flight checks prevent common failures by validating:
- PipeCraft configuration exists and is valid
- Git repository is properly initialized
- Git remote is configured
- Workflow directories are writable
- Node.js version meets minimum requirements

All checks return structured results with actionable error messages and suggestions.
This provides a better user experience by catching issues early with clear guidance
on how to resolve them.

## Interfaces

### PreflightChecks

Defined in: [utils/preflight.ts:47](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L47)

Collection of all pre-flight check results.

Each field represents a specific environment check that must pass
before workflows can be generated.

#### Properties

##### canWriteGithubDir

```ts
canWriteGithubDir: PreflightResult;
```

Defined in: [utils/preflight.ts:61](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L61)

.github/workflows directory is writable

##### configExists

```ts
configExists: PreflightResult;
```

Defined in: [utils/preflight.ts:49](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L49)

Configuration file exists and is discoverable

##### configValid

```ts
configValid: PreflightResult;
```

Defined in: [utils/preflight.ts:52](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L52)

Configuration file is valid and has required fields

##### hasGitRemote

```ts
hasGitRemote: PreflightResult;
```

Defined in: [utils/preflight.ts:58](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L58)

Git remote (origin) is configured

##### inGitRepo

```ts
inGitRepo: PreflightResult;
```

Defined in: [utils/preflight.ts:55](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L55)

Current directory is a git repository

***

### PreflightResult

Defined in: [utils/preflight.ts:30](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L30)

Result of a single pre-flight check.

Contains pass/fail status, descriptive message, and optional suggestion
for resolving failures.

#### Properties

##### message

```ts
message: string;
```

Defined in: [utils/preflight.ts:35](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L35)

Human-readable description of the check result

##### passed

```ts
passed: boolean;
```

Defined in: [utils/preflight.ts:32](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L32)

Whether the check passed

##### suggestion?

```ts
optional suggestion: string;
```

Defined in: [utils/preflight.ts:38](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L38)

Optional suggestion for resolving failures

## Functions

### checkCanWriteGithubDir()

```ts
function checkCanWriteGithubDir(): PreflightResult;
```

Defined in: [utils/preflight.ts:310](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L310)

Check if .github/workflows directory exists and is writable.

Workflows are written to .github/workflows/, so this directory must:
- Exist or be creatable
- Be writable by the current user

This check attempts to:
1. Create .github/workflows/ if it doesn't exist
2. Write a test file to verify write permissions
3. Clean up the test file

#### Returns

[`PreflightResult`](#preflightresult)

Check result indicating if directory is writable

#### Example

```typescript
const result = checkCanWriteGithubDir()
if (!result.passed) {
  if (result.message.includes('permission')) {
    // Fix permissions
    execSync('chmod +w .github/workflows/')
  }
}
```

***

### checkConfigExists()

```ts
function checkConfigExists(): PreflightResult;
```

Defined in: [utils/preflight.ts:86](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L86)

Check if PipeCraft configuration file exists.

Uses cosmiconfig to search for configuration files in standard locations:
- .pipecraftrc.json
- .pipecraftrc (JSON or YAML)
- pipecraft.config.js
- package.json (pipecraft key)

Searches current directory and all parent directories.

#### Returns

[`PreflightResult`](#preflightresult)

Check result with pass/fail status and file location if found

#### Example

```typescript
const result = checkConfigExists()
if (!result.passed) {
  console.error(result.message)
  console.log(result.suggestion) // "Run 'pipecraft init' to create..."
}
```

***

### checkConfigValid()

```ts
function checkConfigValid(): PreflightResult;
```

Defined in: [utils/preflight.ts:126](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L126)

Check if configuration file is valid and contains required fields.

Validates:
- File can be parsed (valid JSON/YAML)
- Required fields are present (ciProvider, branchFlow, domains)
- At least one domain is configured

#### Returns

[`PreflightResult`](#preflightresult)

Check result with validation status and specific error if invalid

#### Example

```typescript
const result = checkConfigValid()
if (!result.passed) {
  if (result.message.includes('missing required fields')) {
    // Config exists but incomplete
  } else if (result.message.includes('Invalid JSON')) {
    // Syntax error in config file
  }
}
```

***

### checkHasGitRemote()

```ts
function checkHasGitRemote(): PreflightResult;
```

Defined in: [utils/preflight.ts:251](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L251)

Check if git remote named 'origin' is configured.

A git remote is required for:
- Pushing generated workflows to GitHub
- Repository information extraction
- GitHub API integration

Checks specifically for the 'origin' remote, which is the standard
default remote name. Also detects if the remote is GitHub vs. GitLab
and provides appropriate messaging.

#### Returns

[`PreflightResult`](#preflightresult)

Check result with remote URL if configured

#### Example

```typescript
const result = checkHasGitRemote()
if (!result.passed) {
  console.log('No git remote found')
  execSync('git remote add origin https://github.com/user/repo.git')
} else if (result.suggestion) {
  // GitLab detected - show warning about experimental support
  console.warn(result.suggestion)
}
```

***

### checkInGitRepo()

```ts
function checkInGitRepo(): PreflightResult;
```

Defined in: [utils/preflight.ts:205](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L205)

Check if current directory is inside a git repository.

PipeCraft requires a git repository to:
- Generate GitHub Actions workflows
- Track version history
- Enable version management features

Uses `git rev-parse --is-inside-work-tree` to detect git repository.
Suppresses stderr to avoid noise when git is not initialized.

#### Returns

[`PreflightResult`](#preflightresult)

Check result indicating if directory is in a git repository

#### Example

```typescript
const result = checkInGitRepo()
if (!result.passed) {
  console.log('Please initialize git first')
  execSync('git init')
}
```

***

### checkNodeVersion()

```ts
function checkNodeVersion(minVersion): PreflightResult;
```

Defined in: [utils/preflight.ts:377](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L377)

Check if Node.js version meets minimum requirement.

PipeCraft requires Node.js 18.0.0 or higher because it uses:
- Modern ES modules
- Latest TypeScript features
- Current GitHub Actions syntax

Only checks major version for simplicity. Minor/patch versions
within the same major release are considered compatible.

#### Parameters

##### minVersion

`string` = `'18.0.0'`

Minimum required version (default: '18.0.0')

#### Returns

[`PreflightResult`](#preflightresult)

Check result with current and minimum versions

#### Example

```typescript
const result = checkNodeVersion('18.0.0')
if (!result.passed) {
  console.error('Please upgrade Node.js')
  console.log('Current:', process.version)
  console.log('Required: >= 18.0.0')
}
```

***

### formatPreflightResults()

```ts
function formatPreflightResults(checks): object;
```

Defined in: [utils/preflight.ts:470](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L470)

Format pre-flight check results for human-readable display.

Converts structured check results into formatted output with:
- ✅/❌ icons for visual scanning
- Error messages and suggestions
- Next steps if all checks passed
- Helpful guidance for getting started

The output is designed to be printed directly to the console.

#### Parameters

##### checks

[`PreflightChecks`](#preflightchecks)

Collection of check results from runPreflightChecks()

#### Returns

`object`

Formatted output object with overall status and display string

##### allPassed

```ts
allPassed: boolean;
```

##### nextSteps?

```ts
optional nextSteps: string[];
```

##### output

```ts
output: string;
```

#### Example

```typescript
const checks = runPreflightChecks()
const { allPassed, output, nextSteps } = formatPreflightResults(checks)

console.log(output)

if (allPassed && nextSteps) {
  console.log('\n' + nextSteps.join('\n'))
} else {
  console.error('\n⚠ Fix the above issues and try again')
  process.exit(1)
}
```

***

### runPreflightChecks()

```ts
function runPreflightChecks(): PreflightChecks;
```

Defined in: [utils/preflight.ts:431](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/utils/preflight.ts#L431)

Run all pre-flight checks for workflow generation.

Executes comprehensive environment validation to ensure all prerequisites
are met before attempting to generate workflows. This prevents partial
failures and provides clear error messages upfront.

Checks performed:
- Configuration file exists
- Configuration is valid
- Inside git repository
- Git remote configured
- Workflow directory writable

Note: Node version check is optional and not included by default since
if Node is too old, the code wouldn't run at all.

#### Returns

[`PreflightChecks`](#preflightchecks)

Collection of all check results

#### Example

```typescript
const checks = runPreflightChecks()
const { allPassed, output } = formatPreflightResults(checks)

if (!allPassed) {
  console.error('Pre-flight checks failed:')
  console.log(output)
  process.exit(1)
}

// Proceed with workflow generation
await generateWorkflows()
```
