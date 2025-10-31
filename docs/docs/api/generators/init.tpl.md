# generators/init.tpl

Init Template Generator

Generates the initial PipeCraft configuration file (.pipecraftrc.json) with default settings.
This generator is invoked by the `pipecraft init` command and prompts the user for
basic project configuration preferences.

## Example

```typescript
import { generate } from './generators/init.tpl.js'

// Called by CLI with Pinion context
await generate(pinionContext)

// Creates .pipecraftrc.json with:
// - CI provider (GitHub/GitLab)
// - Merge strategy (fast-forward/merge)
// - Branch flow configuration
// - Domain-based change detection
// - Semantic versioning rules
```

## Note

Current Implementation: The generator currently uses hardcoded defaults
from `defaultConfig` regardless of user prompt responses. This is intentional
for the initial release to ensure consistent behavior. Future versions will
respect user input and allow customization.

## Functions

### generate()

```ts
function generate(ctx): Promise<PinionContext>
```

Defined in: [generators/init.tpl.ts:162](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/generators/init.tpl.ts#L162)

Init generator main entry point.

Orchestrates the initialization process by:

1. Prompting user for project preferences (currently unused - see note)
2. Merging user input with default configuration
3. Generating and writing .pipecraftrc.json file

#### Parameters

##### ctx

`PinionContext`

Pinion generator context from CLI

#### Returns

`Promise`\<`PinionContext`\>

Updated context after file generation

#### Throws

If configuration file cannot be written

#### Throws

If user input validation fails

#### Example

```typescript
// Called by Pinion framework when user runs `pipecraft init`
const result = await generate({
  cwd: '/path/to/project',
  argv: ['init'],
  pinion: { ... }
})

// Results in: /path/to/project/.pipecraftrc.json
```

#### Note

Current Behavior: Despite prompting for user input, the generator
currently overwrites all responses with `defaultConfig` values (line 167).
This ensures consistency for the initial release. Future versions will
respect user choices and allow customization of branch names, merge strategies,
and domain configurations.

Prompts Presented (currently unused):

- Project name
- CI provider (GitHub/GitLab)
- Merge strategy (fast-forward/merge)
- Conventional commits enforcement
- Development branch name
- Production branch name
- Branch flow sequence
