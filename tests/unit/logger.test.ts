/**
 * Comprehensive Logger Tests
 *
 * Tests all logger functionality including:
 * - All log levels (silent, normal, verbose, debug)
 * - All log methods (info, success, warn, error, verbose, debug)
 * - Level setting and getting
 * - Level hierarchy and filtering
 * - Console output verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { logger } from '../../src/utils/logger.js'
import type { LogLevel } from '../../src/utils/logger.js'

describe('Logger', () => {
  let consoleSpies: {
    log: any
    info: any
    warn: any
    error: any
  }

  beforeEach(() => {
    // Spy on console methods
    consoleSpies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }
    
    // Reset to default level
    logger.setLevel('normal')
  })

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpies).forEach(spy => spy.mockRestore())
  })

  describe('Level Management', () => {
    it('should set and get log level', () => {
      logger.setLevel('debug')
      expect(logger.getLevel()).toBe('debug')
      
      logger.setLevel('silent')
      expect(logger.getLevel()).toBe('silent')
    })

    it('should default to normal level', () => {
      expect(logger.getLevel()).toBe('normal')
    })

    it('should accept all valid log levels', () => {
      const validLevels: LogLevel[] = [
        'silent',
        'normal',
        'verbose',
        'debug'
      ]

      validLevels.forEach(level => {
        logger.setLevel(level)
        expect(logger.getLevel()).toBe(level)
      })
    })
  })

  describe('info() method', () => {
    it('should log at normal level', () => {
      logger.setLevel('normal')
      logger.info('Test message')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Test message')
    })

    it('should log at verbose level', () => {
      logger.setLevel('verbose')
      logger.info('Test message')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Test message')
    })

    it('should log at debug level', () => {
      logger.setLevel('debug')
      logger.info('Test message')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Test message')
    })

    it('should not log at silent level', () => {
      logger.setLevel('silent')
      logger.info('Test message')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      logger.setLevel('normal')
      logger.info('Test', 'with', 'multiple', 'arguments')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Test', 'with', 'multiple', 'arguments')
    })

    it('should handle no arguments', () => {
      logger.setLevel('normal')
      logger.info()
      
      expect(consoleSpies.log).toHaveBeenCalledWith()
    })
  })

  describe('success() method', () => {
    it('should log at normal level', () => {
      logger.setLevel('normal')
      logger.success('Operation completed')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Operation completed')
    })

    it('should not log at silent level', () => {
      logger.setLevel('silent')
      logger.success('Operation completed')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      logger.setLevel('normal')
      logger.success('Build', 'succeeded')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Build', 'succeeded')
    })
  })

  describe('warn() method', () => {
    it('should log at normal level', () => {
      logger.setLevel('normal')
      logger.warn('This is a warning')
      
      expect(consoleSpies.warn).toHaveBeenCalledWith('This is a warning')
    })

    it('should log at verbose level', () => {
      logger.setLevel('verbose')
      logger.warn('This is a warning')
      
      expect(consoleSpies.warn).toHaveBeenCalledWith('This is a warning')
    })

    it('should not log at silent level', () => {
      logger.setLevel('silent')
      logger.warn('This is a warning')
      
      expect(consoleSpies.warn).not.toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      logger.setLevel('normal')
      logger.warn('Warning:', 'deprecated API')
      
      expect(consoleSpies.warn).toHaveBeenCalledWith('Warning:', 'deprecated API')
    })
  })

  describe('error() method', () => {
    it('should log at all non-silent levels', () => {
      const levels: LogLevel[] = ['normal', 'verbose', 'debug']

      levels.forEach(level => {
        consoleSpies.error.mockClear()
        logger.setLevel(level)
        logger.error('Test error')
        
        expect(consoleSpies.error).toHaveBeenCalledWith('Test error')
      })
    })

    it('should not log at silent level', () => {
      logger.setLevel('silent')
      logger.error('Test error')
      
      expect(consoleSpies.error).not.toHaveBeenCalled()
    })

    it('should handle Error objects', () => {
      logger.setLevel('normal')
      const error = new Error('Something went wrong')
      logger.error('Failed:', error)
      
      expect(consoleSpies.error).toHaveBeenCalledWith('Failed:', error)
    })

    it('should handle multiple arguments', () => {
      logger.setLevel('normal')
      logger.error('Error code:', 500, 'message:', 'Internal error')
      
      expect(consoleSpies.error).toHaveBeenCalledWith('Error code:', 500, 'message:', 'Internal error')
    })
  })

  describe('verbose() method', () => {
    it('should log at verbose level', () => {
      logger.setLevel('verbose')
      logger.verbose('Detailed information')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Detailed information')
    })

    it('should log at debug level', () => {
      logger.setLevel('debug')
      logger.verbose('Detailed information')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Detailed information')
    })

    it('should not log at normal level', () => {
      logger.setLevel('normal')
      logger.verbose('Detailed information')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should not log at silent level', () => {
      logger.setLevel('silent')
      logger.verbose('Detailed information')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      logger.setLevel('verbose')
      logger.verbose('Processing file:', 'config.json')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Processing file:', 'config.json')
    })
  })

  describe('debug() method', () => {
    it('should log only at debug level', () => {
      logger.setLevel('debug')
      logger.debug('Debug information')
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Debug information')
    })

    it('should not log at verbose level', () => {
      logger.setLevel('verbose')
      logger.debug('Debug information')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should not log at normal level', () => {
      logger.setLevel('normal')
      logger.debug('Debug information')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should not log at silent level', () => {
      logger.setLevel('silent')
      logger.debug('Debug information')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    it('should handle multiple arguments', () => {
      logger.setLevel('debug')
      logger.debug('Variable value:', { foo: 'bar' })
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Variable value:', { foo: 'bar' })
    })

    it('should handle complex objects', () => {
      logger.setLevel('debug')
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' }
        }
      }
      logger.debug('Complex data:', complexObject)
      
      expect(consoleSpies.log).toHaveBeenCalledWith('Complex data:', complexObject)
    })
  })

  describe('Log Level Hierarchy', () => {
    it('should respect normal level - show info, success, warn, error only', () => {
      logger.setLevel('normal')
      
      logger.info('info')
      logger.success('success')
      logger.warn('warn')
      logger.error('error')
      logger.verbose('verbose')
      logger.debug('debug')
      
      // Info and success use console.log
      expect(consoleSpies.log).toHaveBeenCalledTimes(2)
      expect(consoleSpies.log).toHaveBeenCalledWith('info')
      expect(consoleSpies.log).toHaveBeenCalledWith('success')
      
      // Warn uses console.warn
      expect(consoleSpies.warn).toHaveBeenCalledTimes(1)
      expect(consoleSpies.warn).toHaveBeenCalledWith('warn')
      
      // Error uses console.error
      expect(consoleSpies.error).toHaveBeenCalledTimes(1)
      expect(consoleSpies.error).toHaveBeenCalledWith('error')
    })

    it('should respect verbose level - show normal + verbose', () => {
      logger.setLevel('verbose')
      
      logger.info('info')
      logger.success('success')
      logger.warn('warn')
      logger.error('error')
      logger.verbose('verbose')
      logger.debug('debug')
      
      // Info, success, and verbose use console.log
      expect(consoleSpies.log).toHaveBeenCalledTimes(3)
      expect(consoleSpies.log).toHaveBeenCalledWith('info')
      expect(consoleSpies.log).toHaveBeenCalledWith('success')
      expect(consoleSpies.log).toHaveBeenCalledWith('verbose')
      
      // Warn uses console.warn
      expect(consoleSpies.warn).toHaveBeenCalledTimes(1)
      
      // Error uses console.error
      expect(consoleSpies.error).toHaveBeenCalledTimes(1)
    })

    it('should respect debug level - show everything', () => {
      logger.setLevel('debug')
      
      logger.info('info')
      logger.success('success')
      logger.warn('warn')
      logger.error('error')
      logger.verbose('verbose')
      logger.debug('debug')
      
      // Info, success, verbose, and debug use console.log
      expect(consoleSpies.log).toHaveBeenCalledTimes(4)
      expect(consoleSpies.log).toHaveBeenCalledWith('info')
      expect(consoleSpies.log).toHaveBeenCalledWith('success')
      expect(consoleSpies.log).toHaveBeenCalledWith('verbose')
      expect(consoleSpies.log).toHaveBeenCalledWith('debug')
      
      // Warn uses console.warn
      expect(consoleSpies.warn).toHaveBeenCalledTimes(1)
      
      // Error uses console.error
      expect(consoleSpies.error).toHaveBeenCalledTimes(1)
    })

    it('should respect silent level - show nothing', () => {
      logger.setLevel('silent')
      
      logger.info('info')
      logger.success('success')
      logger.warn('warn')
      logger.error('error')
      logger.verbose('verbose')
      logger.debug('debug')
      
      // Nothing should be logged
      expect(consoleSpies.log).toHaveBeenCalledTimes(0)
      expect(consoleSpies.warn).toHaveBeenCalledTimes(0)
      expect(consoleSpies.error).toHaveBeenCalledTimes(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined', () => {
      logger.setLevel('normal')
      logger.info(null, undefined)
      
      expect(consoleSpies.log).toHaveBeenCalledWith(null, undefined)
    })

    it('should handle numbers', () => {
      logger.setLevel('normal')
      logger.info(42, 3.14)
      
      expect(consoleSpies.log).toHaveBeenCalledWith(42, 3.14)
    })

    it('should handle booleans', () => {
      logger.setLevel('normal')
      logger.info(true, false)
      
      expect(consoleSpies.log).toHaveBeenCalledWith(true, false)
    })

    it('should handle arrays', () => {
      logger.setLevel('normal')
      logger.info(['a', 'b', 'c'])
      
      expect(consoleSpies.log).toHaveBeenCalledWith(['a', 'b', 'c'])
    })

    it('should handle objects', () => {
      logger.setLevel('normal')
      const obj = { key: 'value' }
      logger.info(obj)
      
      expect(consoleSpies.log).toHaveBeenCalledWith(obj)
    })
  })

  describe('Real-World Usage Patterns', () => {
    it('should support changing level at runtime', () => {
      logger.setLevel('debug')
      logger.debug('debug message')
      expect(consoleSpies.log).toHaveBeenCalledTimes(1)
      
      consoleSpies.log.mockClear()
      
      logger.setLevel('normal')
      logger.debug('should not appear')
      expect(consoleSpies.log).toHaveBeenCalledTimes(0)
    })

    it('should support production mode (silent)', () => {
      logger.setLevel('silent')
      
      // Typical production logging - nothing should appear
      logger.info('Starting process')
      logger.verbose('Loading config')
      logger.debug('Config details')
      logger.success('Process complete')
      logger.error('Critical error')
      
      expect(consoleSpies.log).not.toHaveBeenCalled()
      expect(consoleSpies.warn).not.toHaveBeenCalled()
      expect(consoleSpies.error).not.toHaveBeenCalled()
    })

    it('should support development mode (debug)', () => {
      logger.setLevel('debug')
      
      // Typical development logging - everything should appear
      logger.info('Starting process')
      logger.verbose('Loading config')
      logger.debug('Config details')
      logger.success('Process complete')
      
      expect(consoleSpies.log).toHaveBeenCalledTimes(4)
    })

    it('should support normal user-facing mode', () => {
      logger.setLevel('normal')
      
      // Normal CLI usage - show important messages only
      logger.info('Generating workflows...')
      logger.verbose('Reading config from .pipecraftrc.json') // Hidden
      logger.debug('Config object: {...}') // Hidden
      logger.success('✓ Workflows generated')
      
      expect(consoleSpies.log).toHaveBeenCalledTimes(2) // info and success only
    })
  })
})
