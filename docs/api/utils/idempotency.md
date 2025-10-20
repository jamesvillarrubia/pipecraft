[**pipecraft v0.0.0-releaseit**](../README.md)

***

[pipecraft](../README.md) / utils/idempotency

# utils/idempotency

Idempotency and Caching Utilities

This module implements intelligent caching to avoid unnecessary workflow regeneration.
It tracks file hashes and modification times for:
- Configuration files (.pipecraftrc.json)
- Template source files (src/templates/)
- Generator code (src/generators/)

Workflows are only regenerated when relevant source files have changed,
significantly improving performance during iterative development.

The cache is stored in `.pipecraft-cache.json` and contains hashes
of all tracked files along with metadata.

## Classes

### IdempotencyManager

Defined in: [utils/idempotency.ts:82](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L82)

Manager for idempotent workflow generation through intelligent caching.

This class tracks changes to configuration and template files to determine
when workflows need to be regenerated. It creates cryptographic hashes of
files and directories to detect changes efficiently.

#### Example

```typescript
const manager = new IdempotencyManager(config)

if (await manager.hasChanges()) {
  // Generate workflows
  await generateWorkflows()
  // Update cache after successful generation
  await manager.updateCache()
} else {
  console.log('No changes detected, skipping regeneration')
}
```

#### Constructors

##### Constructor

> **new IdempotencyManager**(`config`, `cacheFile`): [`IdempotencyManager`](#idempotencymanager)

Defined in: [utils/idempotency.ts:92](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L92)

Create a new IdempotencyManager instance.

###### Parameters

###### config

[`PipecraftConfig`](../types.md#pipecraftconfig)

PipeCraft configuration object

###### cacheFile

`string` = `'.pipecraft-cache.json'`

Path to cache file (default: .pipecraft-cache.json)

###### Returns

[`IdempotencyManager`](#idempotencymanager)

#### Methods

##### calculateHash()

> **calculateHash**(`filePath`, `algorithm`): `Promise`\<`string`\>

Defined in: [utils/idempotency.ts:115](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L115)

Calculate cryptographic hash for a file or directory.

For files: Hashes content + mtime + size to detect any changes
For directories: Recursively hashes all files within

Returns empty string if the path doesn't exist.

###### Parameters

###### filePath

`string`

Path to file or directory to hash

###### algorithm

`string` = `'sha256'`

Hashing algorithm (default: sha256)

###### Returns

`Promise`\<`string`\>

Hex-encoded hash string

###### Example

```typescript
const configHash = await manager.calculateHash('.pipecraftrc.json')
const templateHash = await manager.calculateHash('src/templates')
```

##### hasChanges()

> **hasChanges**(): `Promise`\<`boolean`\>

Defined in: [utils/idempotency.ts:239](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L239)

Check if any tracked files have changed since last generation.

Compares current file hashes against cached values to detect changes in:
- Configuration file (.pipecraftrc.json)
- Template source files (src/templates/)
- Generator code (src/generators/)

Returns true if:
- Rebuild is disabled (always regenerate)
- Force regenerate flag is set
- No cache exists
- Any tracked file has changed

###### Returns

`Promise`\<`boolean`\>

true if workflows should be regenerated

###### Example

```typescript
if (await manager.hasChanges()) {
  console.log('Changes detected, regenerating workflows...')
  await generateWorkflows()
  await manager.updateCache()
}
```

##### loadCache()

> **loadCache**(): [`RebuildCache`](#rebuildcache) \| `null`

Defined in: [utils/idempotency.ts:184](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L184)

Load rebuild cache from filesystem.

Reads and parses the cache file containing previous generation state.
Returns null if cache doesn't exist or can't be parsed.

###### Returns

[`RebuildCache`](#rebuildcache) \| `null`

Parsed cache object or null if unavailable

##### saveCache()

> **saveCache**(`cache`): `void`

Defined in: [utils/idempotency.ts:206](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L206)

Save rebuild cache to filesystem.

Writes the cache object to disk as formatted JSON.
Failures are logged as warnings but don't throw errors.

###### Parameters

###### cache

[`RebuildCache`](#rebuildcache)

Cache object to persist

###### Returns

`void`

##### shouldRegenerateFile()

> **shouldRegenerateFile**(`filePath`): `Promise`\<`boolean`\>

Defined in: [utils/idempotency.ts:344](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L344)

Check if a specific file should be regenerated.

Similar to hasChanges() but checks a single file instead of the
entire project. Useful for selective regeneration.

###### Parameters

###### filePath

`string`

Path to file to check

###### Returns

`Promise`\<`boolean`\>

true if file should be regenerated

###### Example

```typescript
if (await manager.shouldRegenerateFile('.github/workflows/pipeline.yml')) {
  await generatePipeline()
}
```

##### updateCache()

> **updateCache**(): `Promise`\<`void`\>

Defined in: [utils/idempotency.ts:295](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L295)

Update cache with current file states after successful generation.

Should be called after workflows are successfully generated to save
the current state of all tracked files. This allows future runs to
skip regeneration if nothing has changed.

###### Returns

`Promise`\<`void`\>

###### Example

```typescript
await generateWorkflows()
await manager.updateCache() // Save current state
```

## Interfaces

### FileHash

Defined in: [utils/idempotency.ts:27](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L27)

Metadata and hash information for a tracked file.

#### Properties

##### hash

> **hash**: `string`

Defined in: [utils/idempotency.ts:32](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L32)

Cryptographic hash of file content and metadata

##### mtime

> **mtime**: `number`

Defined in: [utils/idempotency.ts:35](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L35)

Last modification time (Unix timestamp in milliseconds)

##### path

> **path**: `string`

Defined in: [utils/idempotency.ts:29](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L29)

Relative path to the file

##### size

> **size**: `number`

Defined in: [utils/idempotency.ts:38](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L38)

File size in bytes

***

### RebuildCache

Defined in: [utils/idempotency.ts:47](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L47)

Complete rebuild cache structure stored in .pipecraft-cache.json.

This cache enables idempotent workflow generation by tracking when
configuration or template files change.

#### Properties

##### configHash

> **configHash**: `string`

Defined in: [utils/idempotency.ts:52](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L52)

Hash of the configuration file (.pipecraftrc.json)

##### files

> **files**: `Record`\<`string`, [`FileHash`](#filehash)\>

Defined in: [utils/idempotency.ts:49](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L49)

Map of file paths to their hash metadata

##### lastGenerated

> **lastGenerated**: `number`

Defined in: [utils/idempotency.ts:55](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L55)

Timestamp when workflows were last generated

##### version

> **version**: `string`

Defined in: [utils/idempotency.ts:58](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/idempotency.ts#L58)

Cache format version for future migration compatibility
