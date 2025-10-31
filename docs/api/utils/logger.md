[**pipecraft v0.0.0-releaseit**](../README.md)

---

[pipecraft](../README.md) / utils/logger

# utils/logger

Logging Utility with Configurable Verbosity

This module provides a singleton logger instance with multiple verbosity levels
to control console output. The logger supports four levels:

- silent: No output (useful for programmatic usage or CI environments)
- normal: Standard output (info, success, warn, error)
- verbose: Normal + verbose messages (detailed operation info)
- debug: Verbose + debug messages (maximum detail for troubleshooting)

The log level can be changed at runtime using --verbose or --debug flags
passed to the CLI commands.

## Type Aliases

### LogLevel

> **LogLevel** = `"silent"` \| `"normal"` \| `"verbose"` \| `"debug"`

Defined in: [utils/logger.ts:24](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/logger.ts#L24)

Available log verbosity levels in ascending order of detail.

- silent: No console output
- normal: Standard operational messages
- verbose: Detailed operational messages
- debug: Maximum detail including internal state

## Variables

### logger

> `const` **logger**: `Logger`

Defined in: [utils/logger.ts:169](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/utils/logger.ts#L169)

Singleton logger instance exported for use throughout the application.

#### Example

```typescript
import { logger } from '@/utils/logger'

logger.info('Starting workflow generation...')
logger.verbose('Loading config from:', configPath)
logger.debug('Config object:', config)
logger.success('✓ Workflows generated successfully')
logger.warn('⚠ No git remote found')
logger.error('✗ Validation failed:', error.message)
```
