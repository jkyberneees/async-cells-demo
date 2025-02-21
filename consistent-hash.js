import crypto from 'crypto'

/**
 * ConsistentHash implements consistent hashing with virtual nodes for better distribution.
 * It uses MD5 for hashing and maintains a ring-based structure for efficient lookups.
 */
class ConsistentHash {
  /**
   * Initialize the consistent hash ring
   * @param {Object} options Configuration options
   * @param {number} [options.virtualNodes=100] Number of virtual nodes per real node
   */
  constructor(options = {}) {
    this.virtualNodes = options.virtualNodes || 100
    this.ring = [] // Sorted array of virtual node hashes
    this.nodes = new Set() // Set of real nodes
    this.virtualToReal = new Map() // Maps virtual node hash to real node
  }

  /**
   * Generate MD5 hash for a given key
   * @private
   * @param {string} key The key to hash
   * @returns {string} Hexadecimal hash value
   */
  _hash(key) {
    return crypto.createHash('md5').update(key).digest('hex')
  }

  /**
   * Add a node to the hash ring.
   * Creates virtual nodes and inserts them into the ring.
   * @param {string} node Node identifier
   * @throws {Error} If node is invalid or already exists
   */
  add(node) {
    if (!node || typeof node !== 'string') {
      throw new Error('Node must be a non-empty string')
    }
    if (this.nodes.has(node)) {
      throw new Error('Node already exists')
    }
    this.nodes.add(node)

    // Add virtual nodes for this real node
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualNode = `${node}-vn-${i}`
      const hash = this._hash(virtualNode)
      this.ring.push(hash)
      this.virtualToReal.set(hash, node)
    }
    // Keep ring sorted for efficient binary search lookups
    this.ring.sort()
  }

  /**
   * Remove a node from the hash ring.
   * Removes all associated virtual nodes.
   * @param {string} node Node identifier
   * @throws {Error} If node doesn't exist
   */
  remove(node) {
    if (!this.nodes.has(node)) {
      throw new Error('Node does not exist')
    }
    this.nodes.delete(node)

    // Compute all virtual node hashes for the removed node and remove them.
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualNode = `${node}-vn-${i}`
      const hash = this._hash(virtualNode)
      this.virtualToReal.delete(hash)
    }
    // Filter the ring array to remove all virtual nodes for this node.
    this.ring = this.ring.filter((hash) => this.virtualToReal.has(hash))
  }

  /**
   * Get the node responsible for a given key.
   * Uses binary search to efficiently find the closest virtual node's real node.
   * @param {string} key The key to look up
   * @returns {string|null} The responsible node, or null if no nodes exist
   * @throws {Error} If key is invalid
   */
  get(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string')
    }
    if (this.ring.length === 0) {
      return null
    }
    const hash = this._hash(key)

    // Binary search for the first virtual node hash >= key hash.
    let low = 0,
      high = this.ring.length
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (this.ring[mid] < hash) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    const index = low % this.ring.length // wrap around if needed
    return this.virtualToReal.get(this.ring[index])
  }

  /**
   * Get the current number of real nodes in the ring.
   * @returns {number} Number of real nodes.
   */
  size() {
    return this.nodes.size
  }
}

export default ConsistentHash
