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
const addShutdown = require('http-shutdown')

const isFunc = (f) => typeof f === 'function'

const PAUSED = 'toor.paused'
const PAUSE = 'toor.pause'
const UNPAUSED = 'toor.unpaused'
const UNPAUSE = 'toor.unpause'

exports.pause = function pause (worker, cb) {
  const onMessage = (msg) => {
    if (msg === PAUSED) {
      worker.removeListener('message', onMessage)
      cb()
    }
  }
  worker.on('message', onMessage)
  worker.send(PAUSE)
}

exports.unpause = function unpause (worker, cb) {
  const onMessage = (msg) => {
    if (msg === UNPAUSED) {
      worker.removeListener('message', onMessage)
      cb()
    }
  }
  worker.on('message', onMessage)
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
      if (server.hasOwnProperty('httpAllowHalfOpen')) addShutdown(server)
      servers.push(server)
      return server
    }
  }

  wrap(http.Server.prototype, 'listen', listenShimmer)
  wrap(http, 'createServer', createServerShimmer)
  wrap(net.Server.prototype, 'listen', listenShimmer)
  wrap(net, 'createServer', createServerShimmer)

  http.Server.prototype.toorShutdown = function (cb) {
    this.shutdown(cb)
  }

  net.Server.prototype.toorShutdown = function (cb) {
    this.close(cb)
  }

  process.on('message', (msg) => {
    let len = servers.length
    const send = (msg) => () => { if (--len === 0) process.send(msg) }
    const eachServer = (prop, msg, func) => {
      servers.forEach((server) => {
        if (server[prop]) func(server)
        else send(msg)()
      })
    }
    if (msg === UNPAUSE) {
      const listen = (server) =>
        server.listen(...server[listenArgs], send(UNPAUSED))
      eachServer(listenArgs, UNPAUSED, listen)
    }
    if (msg === PAUSE) {
      const close = (server) => server.toorShutdown(send(PAUSED))
      eachServer('listening', PAUSED, close)
    }
  })
}
