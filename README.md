# toor

`toor` makes it easy to **t**ake a worker **o**ut **o**f **r**otation.

When using cluster, it's easy enough to take a worker out of rotation from
inside the worker. Just `close()` the server, and then call `listen()` again
when you want to bring it back again.

In many cases, it's more logical to control which workers are in rotation from
the master process. That's where `toor` comes in handy.

## Usage

First of all, require `toor` near the top of your file.

```js
const toor = require('toor')
```

From your master process, you can call `toor.pause(worker, cb)` on a worker.
The callback is called when all connections are done and the worker is no longer
accepting new requests.

```js
toor.pause(worker, () => console.log('this worker is now paused!'))
```

To have the worker start accepting requests again, call
`toor.unpause(worker, cb)` on it.

```js
toor.unpause(worker, () => console.log('this worker is now unpaused!'))
```

> **WARNING:** `toor` is *invasive*. It does a lot of shimming in the `net`,
`http` and `cluster` modules. If you're not comfortable with that, I'm sorrry!

## License

Code licensed under MIT license. See LICENSE.txt
