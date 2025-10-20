/**
 * Logging Utility with Configurable Verbosity
 *
 * This module provides a singleton logger instance with multiple verbosity levels
 * to control console output. The logger supports four levels:
 * - silent: No output (useful for programmatic usage or CI environments)
 * - normal: Standard output (info, success, warn, error)
 * - verbose: Normal + verbose messages (detailed operation info)
 * - debug: Verbose + debug messages (maximum detail for troubleshooting)
 *
 * Note: This is a test change to verify branch protection rules
 *
 * The log level can be changed at runtime using --verbose or --debug flags
 * passed to the CLI commands.
 *
 * @module utils/logger
 */

/**
 * Available log verbosity levels in ascending order of detail.
 * - silent: No console output
 * - normal: Standard operational messages
 * - verbose: Detailed operational messages
 * - debug: Maximum detail including internal state
 */
export type LogLevel = 'silent' | 'normal' | 'verbose' | 'debug';

/**
 * Logger class providing level-based console output control.
 *
 * This is a singleton class that manages console output throughout the application.
 * Different methods are shown based on the current log level setting.
 */
class Logger {
  private level: LogLevel = 'normal';

  /**
   * Set the current log level.
   *
   * Changes take effect immediately for all subsequent log calls.
   * Typically called once at application startup based on CLI flags.
   *
   * @param level - The log level to set
   *
   * @example
   * ```typescript
   * import { logger } from './logger'
   *
   * // Set from CLI options
   * if (options.debug) logger.setLevel('debug')
   * else if (options.verbose) logger.setLevel('verbose')
   * ```
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   *
   * @returns The current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log an informational message.
   *
   * Shown at normal, verbose, and debug levels.
   * Use for standard operational messages that users should see.
   *
   * @param args - Arguments to log (same as console.log)
   */
  info(...args: any[]): void {
    if (this.level !== 'silent') {
      console.log(...args);
    }
  }

  /**
   * Log a success message.
   *
   * Shown at normal, verbose, and debug levels.
   * Use for successful completion of operations or validation passes.
   *
   * @param args - Arguments to log (same as console.log)
   */
  success(...args: any[]): void {
    if (this.level !== 'silent') {
      console.log(...args);
    }
  }

  /**
   * Log a warning message.
   *
   * Shown at normal, verbose, and debug levels.
   * Use for non-fatal issues that users should be aware of.
   * Outputs to stderr via console.warn.
   *
   * @param args - Arguments to log (same as console.warn)
   */
  warn(...args: any[]): void {
    if (this.level !== 'silent') {
      console.warn(...args);
    }
  }

  /**
   * Log an error message.
   *
   * Shown at normal, verbose, and debug levels.
   * Use for fatal errors or validation failures.
   * Outputs to stderr via console.error.
   *
   * @param args - Arguments to log (same as console.error)
   */
  error(...args: any[]): void {
    if (this.level !== 'silent') {
      console.error(...args);
    }
  }

  /**
   * Log a verbose message.
   *
   * Only shown in verbose or debug mode.
   * Use for detailed operational information like file paths,
   * intermediate results, or configuration details.
   *
   * @param args - Arguments to log (same as console.log)
   */
  verbose(...args: any[]): void {
    if (this.level === 'verbose' || this.level === 'debug') {
      console.log(...args);
    }
  }

  /**
   * Log a debug message.
   *
   * Only shown in debug mode.
   * Use for maximum detail including internal state, variable values,
   * and step-by-step execution flow. Helpful for troubleshooting.
   *
   * @param args - Arguments to log (same as console.log)
   */
  debug(...args: any[]): void {
    if (this.level === 'debug') {
      console.log(...args);
    }
  }
}

/**
 * Singleton logger instance exported for use throughout the application.
 *
 * @example
 * ```typescript
 * import { logger } from '@/utils/logger'
 *
 * logger.info('Starting workflow generation...')
 * logger.verbose('Loading config from:', configPath)
 * logger.debug('Config object:', config)
 * logger.success('✓ Workflows generated successfully')
 * logger.warn('⚠ No git remote found')
 * logger.error('✗ Validation failed:', error.message)
 * ```
 */
export const logger = new Logger();
