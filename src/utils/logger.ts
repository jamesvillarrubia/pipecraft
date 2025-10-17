/**
 * Logger utility with configurable verbosity levels
 */

export type LogLevel = 'silent' | 'normal' | 'verbose' | 'debug';

class Logger {
  private level: LogLevel = 'normal';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Always shown (unless silent)
   */
  info(...args: any[]): void {
    if (this.level !== 'silent') {
      console.log(...args);
    }
  }

  /**
   * Always shown (unless silent)
   */
  success(...args: any[]): void {
    if (this.level !== 'silent') {
      console.log(...args);
    }
  }

  /**
   * Always shown (unless silent)
   */
  warn(...args: any[]): void {
    if (this.level !== 'silent') {
      console.warn(...args);
    }
  }

  /**
   * Always shown (unless silent)
   */
  error(...args: any[]): void {
    if (this.level !== 'silent') {
      console.error(...args);
    }
  }

  /**
   * Only shown in verbose or debug mode
   */
  verbose(...args: any[]): void {
    if (this.level === 'verbose' || this.level === 'debug') {
      console.log(...args);
    }
  }

  /**
   * Only shown in debug mode
   */
  debug(...args: any[]): void {
    if (this.level === 'debug') {
      console.log(...args);
    }
  }
}

// Singleton instance
export const logger = new Logger();
