/**
 * Type-safe helpers for working with YAML AST nodes.
 *
 * This module provides type-safe wrappers around the yaml library's AST operations,
 * reducing the need for 'as any' casts throughout the codebase.
 *
 * @module utils/yaml-helpers
 */

import { Document, YAMLMap, YAMLSeq, Pair, Scalar, isMap, isSeq, isPair, isScalar } from 'yaml'

/**
 * Type guard to check if a value is a YAMLMap
 */
export function isYAMLMap(value: unknown): value is YAMLMap {
  return isMap(value)
}

/**
 * Type guard to check if a value is a YAMLSeq
 */
export function isYAMLSeq(value: unknown): value is YAMLSeq {
  return isSeq(value)
}

/**
 * Type guard to check if a value is a Pair
 */
export function isYAMLPair(value: unknown): value is Pair {
  return isPair(value)
}

/**
 * Type guard to check if a value is a Scalar
 */
export function isYAMLScalar(value: unknown): value is Scalar {
  return isScalar(value)
}

/**
 * Safely get a value from a YAML map by key.
 * Returns undefined if the document contents is not a map or key doesn't exist.
 *
 * @param map - The YAML map to search
 * @param key - The key to look up
 * @returns The value associated with the key, or undefined
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * if (isYAMLMap(jobs)) {
 *   // Work with jobs map
 * }
 * ```
 */
export function getMapValue<T = unknown>(
  map: unknown,
  key: string
): T | undefined {
  if (!isYAMLMap(map)) {
    return undefined
  }

  return map.get(key) as T | undefined
}

/**
 * Safely set a value in a YAML map.
 * Only works if the input is actually a YAMLMap.
 *
 * @param map - The YAML map to modify
 * @param key - The key to set
 * @param value - The value to set
 * @returns true if successful, false if map is not a YAMLMap
 *
 * @example
 * ```typescript
 * if (setMapValue(doc.contents, 'jobs', newJobsMap)) {
 *   console.log('Jobs updated successfully')
 * }
 * ```
 */
export function setMapValue(
  map: unknown,
  key: string,
  value: unknown
): boolean {
  if (!isYAMLMap(map)) {
    return false
  }

  map.set(key, value)
  return true
}

/**
 * Safely delete a key from a YAML map.
 *
 * @param map - The YAML map to modify
 * @param key - The key to delete
 * @returns true if successful, false if map is not a YAMLMap
 *
 * @example
 * ```typescript
 * deleteMapKey(doc.contents, 'deprecated-job')
 * ```
 */
export function deleteMapKey(
  map: unknown,
  key: string
): boolean {
  if (!isYAMLMap(map)) {
    return false
  }

  return map.delete(key)
}

/**
 * Check if a YAML map has a specific key.
 *
 * @param map - The YAML map to check
 * @param key - The key to look for
 * @returns true if key exists, false otherwise
 */
export function hasMapKey(
  map: unknown,
  key: string
): boolean {
  if (!isYAMLMap(map)) {
    return false
  }

  return map.has(key)
}

/**
 * Get all items from a YAML map or sequence as an array.
 * Returns empty array if input is not a collection.
 *
 * @param collection - The YAML collection (map or sequence)
 * @returns Array of items (Pairs for maps, values for sequences)
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * const jobPairs = getCollectionItems(jobs)
 * jobPairs.forEach(pair => {
 *   if (isYAMLPair(pair)) {
 *     console.log(`Job name: ${pair.key}`)
 *   }
 * })
 * ```
 */
export function getCollectionItems(collection: unknown): Array<Pair | unknown> {
  if (isYAMLMap(collection)) {
    return collection.items
  }

  if (isYAMLSeq(collection)) {
    return collection.items
  }

  return []
}

/**
 * Set items for a YAML map or sequence.
 *
 * @param collection - The YAML collection to modify
 * @param items - The items to set
 * @returns true if successful, false if not a collection
 */
export function setCollectionItems(
  collection: unknown,
  items: Array<Pair | unknown>
): boolean {
  if (isYAMLMap(collection)) {
    collection.items = items as Pair[]
    return true
  }

  if (isYAMLSeq(collection)) {
    collection.items = items
    return true
  }

  return false
}

/**
 * Clear all items from a YAML collection.
 *
 * @param collection - The YAML collection to clear
 * @returns true if successful, false if not a collection
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * clearCollection(jobs)
 * ```
 */
export function clearCollection(collection: unknown): boolean {
  return setCollectionItems(collection, [])
}

/**
 * Get the key from a YAML Pair as a string.
 * Returns undefined if not a Pair or key cannot be converted to string.
 *
 * @param pair - The YAML pair
 * @returns The key as a string, or undefined
 */
export function getPairKey(pair: unknown): string | undefined {
  if (!isYAMLPair(pair)) {
    return undefined
  }

  if (isYAMLScalar(pair.key)) {
    return String(pair.key.value)
  }

  return undefined
}

/**
 * Get the value from a YAML Pair.
 * Returns undefined if not a Pair.
 *
 * @param pair - The YAML pair
 * @returns The value, or undefined
 */
export function getPairValue<T = unknown>(pair: unknown): T | undefined {
  if (!isYAMLPair(pair)) {
    return undefined
  }

  return pair.value as T | undefined
}

/**
 * Set the value of a YAML Pair.
 *
 * @param pair - The YAML pair to modify
 * @param value - The new value
 * @returns true if successful, false if not a Pair
 */
export function setPairValue(pair: unknown, value: unknown): boolean {
  if (!isYAMLPair(pair)) {
    return false
  }

  pair.value = value
  return true
}

/**
 * Safely get document contents as a YAMLMap.
 * Returns undefined if contents is not a map.
 *
 * @param doc - The YAML document
 * @returns The contents as a YAMLMap, or undefined
 *
 * @example
 * ```typescript
 * const doc = parseDocument(yamlString)
 * const contents = getDocumentMap(doc)
 * if (contents) {
 *   const jobs = getMapValue(contents, 'jobs')
 * }
 * ```
 */
export function getDocumentMap(doc: Document): YAMLMap | undefined {
  if (isYAMLMap(doc.contents)) {
    return doc.contents
  }
  return undefined
}

/**
 * Find a Pair in a YAML map by key.
 * Returns undefined if map doesn't contain the key.
 *
 * @param map - The YAML map to search
 * @param key - The key to find
 * @returns The Pair with that key, or undefined
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * const testJobPair = findPairByKey(jobs, 'test')
 * if (testJobPair) {
 *   // Modify the test job
 * }
 * ```
 */
export function findPairByKey(map: unknown, key: string): Pair | undefined {
  if (!isYAMLMap(map)) {
    return undefined
  }

  const items = getCollectionItems(map)
  for (const item of items) {
    if (isYAMLPair(item)) {
      const pairKey = getPairKey(item)
      if (pairKey === key) {
        return item
      }
    }
  }

  return undefined
}

/**
 * Filter pairs in a YAML map based on a predicate.
 *
 * @param map - The YAML map to filter
 * @param predicate - Function that returns true for pairs to keep
 * @returns Array of pairs that match the predicate
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * const userJobs = filterPairs(jobs, (pair) => {
 *   const key = getPairKey(pair)
 *   return key && !key.startsWith('pipecraft-')
 * })
 * ```
 */
export function filterPairs(
  map: unknown,
  predicate: (pair: Pair) => boolean
): Pair[] {
  if (!isYAMLMap(map)) {
    return []
  }

  const items = getCollectionItems(map)
  const filtered: Pair[] = []

  for (const item of items) {
    if (isYAMLPair(item) && predicate(item)) {
      filtered.push(item)
    }
  }

  return filtered
}

/**
 * Map over pairs in a YAML map.
 *
 * @param map - The YAML map to iterate over
 * @param mapper - Function to transform each pair
 * @returns Array of transformed values
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * const jobNames = mapPairs(jobs, (pair) => getPairKey(pair))
 * ```
 */
export function mapPairs<T>(
  map: unknown,
  mapper: (pair: Pair) => T
): T[] {
  if (!isYAMLMap(map)) {
    return []
  }

  const items = getCollectionItems(map)
  const mapped: T[] = []

  for (const item of items) {
    if (isYAMLPair(item)) {
      mapped.push(mapper(item))
    }
  }

  return mapped
}

/**
 * Get all keys from a YAML map as strings.
 *
 * @param map - The YAML map
 * @returns Array of key strings
 *
 * @example
 * ```typescript
 * const jobs = getMapValue(doc.contents, 'jobs')
 * const jobNames = getMapKeys(jobs)
 * console.log(`Found jobs: ${jobNames.join(', ')}`)
 * ```
 */
export function getMapKeys(map: unknown): string[] {
  return mapPairs(map, (pair) => getPairKey(pair)).filter((key): key is string => key !== undefined)
}
