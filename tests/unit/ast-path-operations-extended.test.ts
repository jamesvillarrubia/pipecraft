import { describe, it, expect, beforeEach } from 'vitest'
import { parseDocument, stringify } from 'yaml'
import {
  setPathValue,
  getPathValue,
  ensurePathAndApply,
  applyPathOperations,
  createValueFromString,
  createValueFromObject,
  createValueFromArray,
  PathOperationConfig
} from '../../src/utils/ast-path-operations'

describe('AST Path Operations - Extended Coverage', () => {
  let doc: any

  beforeEach(() => {
    doc = parseDocument('name: test\njobs: {}', { keepSourceTokens: true })
  })

  describe('setPathValue', () => {
    it('should handle nested path creation', () => {
      setPathValue(doc.contents, 'jobs.test.runs-on', 'ubuntu-latest')
      const result = doc.contents.get('jobs').get('test').get('runs-on')
      expect(result).toBe('ubuntu-latest')
    })

    it('should apply commentBefore to node', () => {
      setPathValue(doc.contents, 'jobs.test', { name: 'Test' }, doc, 'Test comment')
      const jobNode = doc.contents.get('jobs').get('test')
      expect(jobNode.commentBefore).toContain('Test comment')
    })

    it('should handle setting value on existing path', () => {
      setPathValue(doc.contents, 'name', 'updated')
      expect(doc.contents.get('name')).toBe('updated')
    })

    it('should throw error when parent is not a map', () => {
      doc = parseDocument('value: string', { keepSourceTokens: true })
      expect(() => {
        setPathValue(doc.contents, 'value.nested', 'test')
      }).toThrow('Cannot set nested')
    })
  })

  describe('getPathValue', () => {
    it('should return null for non-existent path', () => {
      const result = getPathValue(doc.contents, 'nonexistent.path')
      expect(result).toBeNull()
    })

    it('should return null for invalid parent node', () => {
      doc = parseDocument('value: string', { keepSourceTokens: true })
      const result = getPathValue(doc.contents, 'value.nested')
      expect(result).toBeNull()
    })

    it('should retrieve nested values', () => {
      setPathValue(doc.contents, 'jobs.test.name', 'Test Job')
      const result = getPathValue(doc.contents, 'jobs.test.name')
      expect(result).toBe('Test Job')
    })

    it('should handle single-level paths', () => {
      const result = getPathValue(doc.contents, 'name')
      expect(result).toBe('test')
    })
  })

  describe('ensurePathAndApply', () => {
    it('should handle "set" operation', () => {
      const config: PathOperationConfig = {
        path: 'jobs.build',
        operation: 'set',
        value: { 'runs-on': 'ubuntu-latest' }
      }
      ensurePathAndApply(doc.contents, config, doc)
      expect(doc.contents.get('jobs').has('build')).toBe(true)
    })

    it('should handle "merge" operation on objects', () => {
      setPathValue(doc.contents, 'env', { NODE_ENV: 'test' })
      const config: PathOperationConfig = {
        path: 'env',
        operation: 'merge',
        value: { DEBUG: 'true' }
      }
      ensurePathAndApply(doc.contents, config, doc)
      const env = doc.contents.get('env')
      expect(env.get('NODE_ENV')).toBe('test')
      expect(env.get('DEBUG')).toBe('true')
    })

    it('should handle "merge" operation on arrays', () => {
      setPathValue(doc.contents, 'branches', ['main', 'develop'])
      const config: PathOperationConfig = {
        path: 'branches',
        operation: 'merge',
        value: ['staging', 'develop'] // develop is duplicate
      }
      ensurePathAndApply(doc.contents, config, doc)
      const branches = doc.contents.get('branches').toJSON()
      expect(branches).toContain('main')
      expect(branches).toContain('develop')
      expect(branches).toContain('staging')
      expect(branches.filter((b: string) => b === 'develop')).toHaveLength(1)
    })

    it('should handle "overwrite" operation', () => {
      setPathValue(doc.contents, 'version', '1.0.0')
      const config: PathOperationConfig = {
        path: 'version',
        operation: 'overwrite',
        value: '2.0.0'
      }
      ensurePathAndApply(doc.contents, config, doc)
      expect(doc.contents.get('version')).toBe('2.0.0')
    })

    it('should handle "preserve" operation', () => {
      setPathValue(doc.contents, 'custom', 'user-value')
      const config: PathOperationConfig = {
        path: 'custom',
        operation: 'preserve',
        value: 'template-value'
      }
      ensurePathAndApply(doc.contents, config, doc)
      expect(doc.contents.get('custom')).toBe('user-value')
    })

    it('should skip non-required paths that don\'t exist', () => {
      const config: PathOperationConfig = {
        path: 'optional.field',
        operation: 'set',
        value: 'test',
        required: false
      }
      // Should not throw
      ensurePathAndApply(doc.contents, config, doc)
    })

    it('should apply commentBefore from config', () => {
      const config: PathOperationConfig = {
        path: 'jobs.test',
        operation: 'set',
        value: { name: 'Test' },
        commentBefore: 'Job comment'
      }
      ensurePathAndApply(doc.contents, config, doc)
      const jobNode = doc.contents.get('jobs').get('test')
      expect(jobNode.commentBefore).toContain('Job comment')
    })
  })

  describe('applyPathOperations', () => {
    it('should apply multiple operations in order', () => {
      const operations: PathOperationConfig[] = [
        { path: 'jobs.build', operation: 'set', value: { name: 'Build' } },
        { path: 'jobs.test', operation: 'set', value: { name: 'Test' } },
        { path: 'jobs.deploy', operation: 'set', value: { name: 'Deploy' } }
      ]
      applyPathOperations(doc.contents, operations, doc)
      expect(doc.contents.get('jobs').get('build').get('name')).toBe('Build')
      expect(doc.contents.get('jobs').get('test').get('name')).toBe('Test')
      expect(doc.contents.get('jobs').get('deploy').get('name')).toBe('Deploy')
    })

    it('should handle empty operations array', () => {
      applyPathOperations(doc.contents, [], doc)
      // Should not throw
      expect(doc.contents.get('name')).toBe('test')
    })
  })

  describe('createValueFromString', () => {
    it('should parse simple YAML string', () => {
      const node = createValueFromString('name: Test Job')
      const yaml = stringify(node)
      expect(yaml).toContain('name: Test Job')
    })

    it('should handle context variable replacement', () => {
      const context = { branch: 'develop' }
      const node = createValueFromString('if: github.ref == \'${branch}\'', context)
      const yaml = stringify(node)
      // The function should process the template literal
      expect(yaml).toBeDefined()
    })

    it('should handle multi-line YAML', () => {
      const yamlStr = `
        name: Multi-line
        steps:
          - uses: actions/checkout@v2
      `
      const node = createValueFromString(yamlStr)
      const result = stringify(node)
      expect(result).toContain('name: Multi-line')
      expect(result).toContain('steps')
    })

    it('should parse with document context', () => {
      const node = createValueFromString('runs-on: ubuntu-latest', undefined, doc)
      expect(stringify(node)).toContain('ubuntu-latest')
    })
  })

  describe('createValueFromObject', () => {
    it('should convert object to YAML node', () => {
      const obj = { name: 'Test', value: 123, enabled: true }
      const node = createValueFromObject(obj)
      const yaml = stringify(node)
      expect(yaml).toContain('name: Test')
      expect(yaml).toContain('value: 123')
      expect(yaml).toContain('enabled: true')
    })

    it('should use document createNode if available', () => {
      const obj = { key: 'value' }
      const node = createValueFromObject(obj, doc)
      expect(node).toBeDefined()
    })

    it('should handle nested objects', () => {
      const obj = {
        outer: {
          inner: {
            value: 'nested'
          }
        }
      }
      const node = createValueFromObject(obj)
      const yaml = stringify(node)
      expect(yaml).toContain('nested')
    })
  })

  describe('createValueFromArray', () => {
    it('should convert array to YAML sequence', () => {
      const arr = ['item1', 'item2', 'item3']
      const node = createValueFromArray(arr)
      const yaml = stringify(node)
      expect(yaml).toContain('item1')
      expect(yaml).toContain('item2')
      expect(yaml).toContain('item3')
    })

    it('should handle array of objects', () => {
      const arr = [
        { name: 'step1' },
        { name: 'step2' }
      ]
      const node = createValueFromArray(arr)
      const yaml = stringify(node)
      expect(yaml).toContain('step1')
      expect(yaml).toContain('step2')
    })

    it('should handle empty array', () => {
      const arr: any[] = []
      const node = createValueFromArray(arr)
      const yaml = stringify(node)
      expect(yaml).toBe('[]\n')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle deeply nested paths', () => {
      setPathValue(doc.contents, 'a.b.c.d.e.f', 'deep')
      const result = getPathValue(doc.contents, 'a.b.c.d.e.f')
      expect(result).toBe('deep')
    })

    it('should handle special characters in values', () => {
      setPathValue(doc.contents, 'message', 'Hello: World! @#$%')
      expect(doc.contents.get('message')).toBe('Hello: World! @#$%')
    })

    it('should handle boolean values', () => {
      setPathValue(doc.contents, 'enabled', true)
      setPathValue(doc.contents, 'disabled', false)
      expect(doc.contents.get('enabled')).toBe(true)
      expect(doc.contents.get('disabled')).toBe(false)
    })

    it('should handle number values', () => {
      setPathValue(doc.contents, 'port', 8080)
      setPathValue(doc.contents, 'timeout', 3.14)
      expect(doc.contents.get('port')).toBe(8080)
      expect(doc.contents.get('timeout')).toBe(3.14)
    })

    it('should handle null values', () => {
      setPathValue(doc.contents, 'nullable', null)
      // YAML may represent null as undefined when retrieving
      const value = doc.contents.get('nullable')
      expect(value === null || value === undefined).toBe(true)
    })
  })
})

