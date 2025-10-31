# utils/config

Configuration Loading and Validation Utilities

This module provides functions to load and validate PipeCraft configuration files.
It uses cosmiconfig to search for configuration in multiple locations:

- .pipecraftrc.json
- .pipecraftrc (JSON or YAML)
- pipecraft.config.js
- package.json (pipecraft key)

The configuration is validated to ensure all required fields are present
and have valid values before being used to generate workflows.

## Functions

### loadConfig()

```ts
function loadConfig(configPath?): any
```

Defined in: [utils/config.ts:44](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/config.ts#L44)

Load PipeCraft configuration from filesystem.

Uses cosmiconfig to search for configuration files in standard locations.
If no path is provided, searches the current directory and ancestors for
configuration files in this order:

1. .pipecraftrc.json
2. .pipecraftrc
3. pipecraft.config.js
4. package.json (pipecraft key)

#### Parameters

##### configPath?

`string`

Optional explicit path to configuration file

#### Returns

`any`

Parsed configuration object

#### Throws

If no configuration file is found

#### Example

```typescript
// Search for config in current directory and ancestors
const config = loadConfig()

// Load from explicit path
const config = loadConfig('./my-config.json')
```

---

### validateConfig()

```ts
function validateConfig(config): boolean
```

Defined in: [utils/config.ts:79](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/utils/config.ts#L79)

Validate PipeCraft configuration structure and values.

Performs comprehensive validation including:

- Presence of all required fields
- Valid enum values (ciProvider, mergeStrategy)
- Branch flow structure (minimum 2 branches)
- Domain configuration (paths, testable, deployable)

Also sets default values for optional domain properties:

- testable defaults to true
- deployable defaults to true

#### Parameters

##### config

`any`

Configuration object to validate (untyped to allow validation)

#### Returns

`boolean`

true if validation passes

#### Throws

If validation fails with detailed error message

#### Example

```typescript
const config = loadConfig()
validateConfig(config) // Throws if invalid
// Safe to use config as PipecraftConfig after this point
```
