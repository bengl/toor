'use strict'
const cluster = require('cluster')
const toor = require('./toor')
const http = require('http')
const net = require('net')
const assert = require('assert')

if (cluster.isMaster) {
  let ready = 0
  const worker1 = cluster.fork()
  const worker2 = cluster.fork()
  const onMessage = (msg) => {
    if (msg === 'ready') {
      ready++
      if (ready === 2) runTest(worker1, worker2)
    }
  }
  worker1.once('message', onMessage)
  worker2.once('message', onMessage)
} else {
  // in worker create 2 servers
  http.createServer((req, res) => {
    res.setHeader('id', cluster.worker.id)
    res.end()
  }).listen(3000)
  net.createServer((socket) => {
    socket.end('' + cluster.worker.id)
  }).listen(3001, () => process.send('ready'))

  // bogus server that never listens
  http.createServer((req, res) => {})

  // bogus messages shouldn't break things
  process.on('message', () => process.send('slartibartfast'))
}

function getSeveralTimes (cb) {
  const results = []
  function get () {
    http.get('http://localhost:' + 3000, (res) => {
      results.push(parseInt(res.headers.id))
      const client = net.connect(3001, () => {
        client.on('data', (d) => {
          client.end()
          results.push(parseInt(d.toString()))
          if (results.length === 12) cb(results)
          else get()
        })
      })
    })
  }
  get()
}

function runTest (worker1, worker2) {
  getSeveralTimes((result) => {
    console.log('should be 1s and 2s', result)
    assert(result.includes(1))
    assert(result.includes(2))
    toor.pause(worker1, () => {
      getSeveralTimes((result) => {
        console.log('should be only 2s  ', result)
        assert(!result.includes(1))
        assert(result.includes(2))
        toor.unpause(worker1, () => {
          getSeveralTimes((result) => {
            console.log('should be 1s and 2s', result)
            assert(result.includes(1))
            assert(result.includes(2))
            worker1.kill()
            worker2.kill()
          })
        })
      })
    })
  })
}
