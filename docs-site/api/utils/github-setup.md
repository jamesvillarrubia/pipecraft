[**pipecraft v0.0.0-releaseit**](../README.md)

***

[pipecraft](../README.md) / utils/github-setup

# utils/github-setup

GitHub Repository Setup and Configuration

This module provides utilities for setting up and configuring GitHub repositories
for use with PipeCraft workflows. It handles:
- Repository information extraction from git remotes
- GitHub authentication token management
- Workflow permissions configuration
- Branch protection rules setup
- Auto-merge enablement

These setup utilities ensure that GitHub repositories have the correct permissions
and settings for PipeCraft workflows to function properly, including:
- Workflows can create pull requests
- Auto-merge is enabled for automated promotions
- Branch protection is configured appropriately
- Required status checks are enforced

## Functions

### configureBranchProtection()

> **configureBranchProtection**(`repoInfo`, `token`, `autoApply`): `Promise`\<`void`\>

Defined in: [utils/github-setup.ts:504](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L504)

Configure branch protection for branches that need auto-merge

#### Parameters

##### repoInfo

`RepositoryInfo`

##### token

`string`

##### autoApply

`boolean`

#### Returns

`Promise`\<`void`\>

***

### enableAutoMerge()

> **enableAutoMerge**(`owner`, `repo`, `token`): `Promise`\<`boolean`\>

Defined in: [utils/github-setup.ts:452](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L452)

Enable auto-merge feature for the repository

#### Parameters

##### owner

`string`

##### repo

`string`

##### token

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getBranchProtection()

> **getBranchProtection**(`owner`, `repo`, `branch`, `token`): `Promise`\<`BranchProtectionRules` \| `null`\>

Defined in: [utils/github-setup.ts:374](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L374)

Get branch protection rules

#### Parameters

##### owner

`string`

##### repo

`string`

##### branch

`string`

##### token

`string`

#### Returns

`Promise`\<`BranchProtectionRules` \| `null`\>

***

### getGitHubToken()

> **getGitHubToken**(): `string`

Defined in: [utils/github-setup.ts:193](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L193)

Get GitHub authentication token from environment or GitHub CLI.

Attempts to retrieve a GitHub personal access token from multiple sources
in this order:
1. GITHUB_TOKEN environment variable
2. GH_TOKEN environment variable
3. GitHub CLI (`gh auth token`) if authenticated

The token is required for GitHub API calls to configure repository settings.
Token must have 'repo' and 'workflow' scopes.

#### Returns

`string`

GitHub personal access token

#### Throws

If no token is found in any source

#### Example

```typescript
// Set token via environment
process.env.GITHUB_TOKEN = 'ghp_xxxxxxxxxxxx'
const token = getGitHubToken()

// Or authenticate with GitHub CLI first
// $ gh auth login
const token = getGitHubToken() // Uses gh CLI token
```

***

### getRepositoryInfo()

> **getRepositoryInfo**(): `RepositoryInfo`

Defined in: [utils/github-setup.ts:140](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L140)

Extract GitHub repository information from git remote configuration.

Parses the git remote URL for the 'origin' remote to extract owner and
repository name. Supports both HTTPS and SSH GitHub URLs:
- HTTPS: https://github.com/owner/repo.git
- SSH: git@github.com:owner/repo.git

This information is required for GitHub API calls to configure repository
settings and permissions.

#### Returns

`RepositoryInfo`

Repository information object

#### Throws

If origin remote is not configured

#### Throws

If remote URL is not a valid GitHub URL

#### Example

```typescript
const info = getRepositoryInfo()
console.log(`Owner: ${info.owner}, Repo: ${info.repo}`)
// Owner: jamesvillarrubia, Repo: pipecraft
```

***

### getRequiredPermissionChanges()

> **getRequiredPermissionChanges**(`currentPermissions`): `Partial`\<`WorkflowPermissions`\> \| `null`

Defined in: [utils/github-setup.ts:278](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L278)

Determine required permission changes without prompting
Returns: changes object if changes needed, null if already correct

#### Parameters

##### currentPermissions

`WorkflowPermissions`

#### Returns

`Partial`\<`WorkflowPermissions`\> \| `null`

***

### getWorkflowPermissions()

> **getWorkflowPermissions**(`owner`, `repo`, `token`): `Promise`\<`WorkflowPermissions`\>

Defined in: [utils/github-setup.ts:221](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L221)

Get current workflow permissions

#### Parameters

##### owner

`string`

##### repo

`string`

##### token

`string`

#### Returns

`Promise`\<`WorkflowPermissions`\>

***

### promptPermissionChanges()

> **promptPermissionChanges**(`currentPermissions`): `Promise`\<`Partial`\<`WorkflowPermissions`\> \| `"declined"` \| `null`\>

Defined in: [utils/github-setup.ts:306](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L306)

Display current permissions and prompt for changes
Returns: changes object if user accepted changes, 'declined' if user declined, null if already correct

#### Parameters

##### currentPermissions

`WorkflowPermissions`

#### Returns

`Promise`\<`Partial`\<`WorkflowPermissions`\> \| `"declined"` \| `null`\>

***

### setupGitHubPermissions()

> **setupGitHubPermissions**(`autoApply`): `Promise`\<`void`\>

Defined in: [utils/github-setup.ts:604](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L604)

Main setup function

#### Parameters

##### autoApply

`boolean` = `false`

#### Returns

`Promise`\<`void`\>

***

### updateBranchProtection()

> **updateBranchProtection**(`owner`, `repo`, `branch`, `token`): `Promise`\<`void`\>

Defined in: [utils/github-setup.ts:407](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L407)

Update branch protection rules to enable auto-merge

#### Parameters

##### owner

`string`

##### repo

`string`

##### branch

`string`

##### token

`string`

#### Returns

`Promise`\<`void`\>

***

### updateWorkflowPermissions()

> **updateWorkflowPermissions**(`owner`, `repo`, `token`, `permissions`): `Promise`\<`void`\>

Defined in: [utils/github-setup.ts:248](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/github-setup.ts#L248)

Update workflow permissions

#### Parameters

##### owner

`string`

##### repo

`string`

##### token

`string`

##### permissions

`Partial`\<`WorkflowPermissions`\>

#### Returns

`Promise`\<`void`\>
