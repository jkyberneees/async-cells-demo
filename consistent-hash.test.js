import { test, describe, beforeEach, expect } from 'bun:test'
import ConsistentHash from './consistent-hash.js'

describe('ConsistentHash', () => {
  let hr

  beforeEach(() => {
    hr = new ConsistentHash()
  })

  describe('Constructor', () => {
    test('should create instance with default virtual nodes', () => {
      expect(hr).toBeInstanceOf(ConsistentHash)
      expect(hr.virtualNodes).toBe(100)
    })

    test('should accept custom number of virtual nodes', () => {
      const customHr = new ConsistentHash({ virtualNodes: 200 })
      expect(customHr.virtualNodes).toBe(200)
    })
  })

  describe('add()', () => {
    test('should add nodes successfully', () => {
      hr.add('server1')
      hr.add('server2')
      expect(hr.size()).toBe(2)
    })

    test('should throw error when adding empty node', () => {
      expect(() => hr.add('')).toThrow('Node must be a non-empty string')
    })

    test('should throw error when adding duplicate node', () => {
      hr.add('server1')
      expect(() => hr.add('server1')).toThrow('Node already exists')
    })

    test('should allow re-adding a node after it has been removed', () => {
      hr.add('server1')
      hr.remove('server1')
      expect(hr.size()).toBe(0)
      // Re-add removed node should succeed.
      hr.add('server1')
      expect(hr.size()).toBe(1)
      expect(hr.get('someKey')).toBe('server1')
    })
  })

  describe('remove()', () => {
    beforeEach(() => {
      hr.add('server1')
      hr.add('server2')
    })

    test('should remove nodes successfully', () => {
      hr.remove('server1')
      expect(hr.size()).toBe(1)
    })

    test('should throw error when removing non-existent node', () => {
      expect(() => hr.remove('server3')).toThrow('Node does not exist')
    })

    test('should remap keys after node removal', () => {
      const key = '2348'
      const originalServer = hr.get(key)
      hr.remove(originalServer)
      const newServer = hr.get(key)
      expect(newServer).not.toBe(originalServer)
    })
  })

  describe('get()', () => {
    beforeEach(() => {
      hr.add('server1')
      hr.add('server2')
    })

    test('should return consistent results for same key', () => {
      const key = '12345'
      const server1 = hr.get(key)
      const server2 = hr.get(key)
      expect(server1).toBe(server2)
    })

    test('should throw error for empty key', () => {
      expect(() => hr.get('')).toThrow('Key must be a non-empty string')
    })

    test('should return null when no nodes exist', () => {
      hr.remove('server1')
      hr.remove('server2')
      expect(hr.get('12345')).toBe(null)
    })

    test('should distribute keys relatively evenly', () => {
      const testKeys = Array.from({ length: 1000 }, (_, i) => `key${i}`)
      const distribution = {}
      testKeys.forEach((key) => {
        const server = hr.get(key)
        distribution[server] = (distribution[server] || 0) + 1
      })

      const values = Object.values(distribution)
      const total = values.reduce((a, b) => a + b, 0)
      const avg = total / values.length
      const threshold = avg * 0.2 // 20% tolerance

      for (let count of values) {
        expect(Math.abs(count - avg)).toBeLessThan(threshold)
      }
    })
  })

  describe('size()', () => {
    test('should return correct number of nodes', () => {
      expect(hr.size()).toBe(0)
      hr.add('server1')
      expect(hr.size()).toBe(1)
      hr.add('server2')
      expect(hr.size()).toBe(2)
      hr.remove('server1')
      expect(hr.size()).toBe(1)
    })
  })
})
