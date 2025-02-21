// Gateway implementation

'use strict'

import gateway from 'fast-gateway'
import ConsistentHash from './consistent-hash'

// Create ConsistentHash object and add cells.
const consistentHash = new ConsistentHash()
consistentHash.add('cell1')
consistentHash.add('cell2')

// Cell to target mapping
const CELL_2_TARGET = {
  cell1: 'http://localhost:3000',
  cell2: 'http://localhost:3001',
}

gateway({
  routes: [
    {
      proxyHandler: (req, res, url, proxy, proxyOpts) => {
        const cell = consistentHash.get(req.params.riderId)
        console.log(`Routing request to ${cell}...`)
        const target = CELL_2_TARGET[cell]

        proxyOpts.base = target

        return proxy(req, res, url, proxyOpts)
      },
      urlRewrite: (req) => {
        return req.url
      },
      prefix: '/api/:riderId',
    },
  ],
})
  .start(8080)
  .then(() => console.log('API Gateway listening on 8080 port!'))

// Below is the services implementation, commonly located on separated projects
const restana = require('restana')

// service1.js
const cell1 = restana()
cell1.get('/api/:riderId/orders/:orderId', (req, res) => {
  res.setHeader('Cell-Id', 'cell1')
  res.send('Order from cell 1!')
})
cell1.start(3000).then(() => console.log('Cell 1 listening on 3000 port!'))

// service1.js
const cell2 = restana()
cell2.get('/api/:riderId/orders/:orderId', (req, res) => {
  res.setHeader('Cell-Id', 'cell2')
  res.send('Order from cell 2!')
})
cell2.start(3001).then(() => console.log('Cell 2 listening on 3001 port!'))
