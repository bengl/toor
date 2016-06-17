/*
Copyright 2016, Yahoo Inc.
Code licensed under the MIT License.
See LICENSE.txt
*/
'use strict'

const cluster = require('cluster')
const http = require('http')
const net = require('net')
const wrap = require('shimmer').wrap

const isFunc = (f) => typeof f === 'function'

const PAUSED = 'toor.paused'
const PAUSE = 'toor.pause'
const UNPAUSED = 'toor.unpaused'
const UNPAUSE = 'toor.paused'

exports.pause = function pause (worker, cb) {
  worker.once('message', (msg) => msg === PAUSED && cb())
  worker.send(PAUSE)
}

exports.unpause = function unpause (worker, cb) {
  worker.once('message', (msg) => msg === UNPAUSED && cb())
  worker.send(UNPAUSE)
}

if (cluster.isWorker) {
  const servers = []
  const listenArgs = Symbol('toorListenArgs')

  const listenShimmer = (original) => {
    return function shimListen (...args) {
      this[listenArgs] = isFunc(args[args.length - 1]) ? args.slice(0, -1) : args
      return original.apply(this, args)
    }
  }

  const createServerShimmer = (original) => {
    return function shimCreateServer (...args) {
      const server = original.apply(this, args)
      servers.push(server)
      return server
    }
  }

  wrap(http.Server.prototype, 'listen', listenShimmer)
  wrap(http, 'createServer', createServerShimmer)
  wrap(net.Server.prototype, 'listen', listenShimmer)
  wrap(net, 'createServer', createServerShimmer)

  process.on('message', (msg) => {
    let len = servers.length
    const send = (msg) => () => --len === 0 && process.send(msg)
    const eachServer = (f) => servers.forEach(f)
    if (msg === UNPAUSE) {
      eachServer((server) => server.listen(...server[listenArgs], send(UNPAUSED)))
    }
    if (msg === PAUSE) {
      eachServer((server) => server.close(send(PAUSED)))
    }
  })
}
