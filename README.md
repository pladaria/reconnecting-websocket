# Reconnecting WebSocket

WebSocket that will automatically reconnect if the connection is closed.

## Features

- Small (~150 LOC)
- WebSocket API compatible (same interface, Level0 and Level2 event model)
- Fully configurable
- Multiplatform (Web, ServiceWorkers, Node.js, React Native)
- Dependency free (does not depends on Window, DOM or any EventEmitter library)
- Reassign event listeners when a new WebSocket instance is created
- Automatic reconnection using [rfc6455](https://tools.ietf.org/html/rfc6455#section-7.2.3) guidelines
- Handle connection timeouts
- Full test coverage
- Debug mode
- Fast close (new in version 3).

## Install

```bash
npm install --save reconnecting-websocket
```

## Run tests

```bash
# clone
git clone https://github.com/pladaria/reconnecting-websocket
# enter
cd reconnecting-websocket
# install deps
npm install
# run tests
npm test

# review the test coverage report
npm run report
```

## Usage

### Compatible with WebSocket Browser API

So this documentation should be valid: [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

Ping me if you find any problems. Or, even better, write a test for your case and make a pull request :)

### Simple usage

```javascript
const WebSocket = require('reconnecting-websocket');
const ws = new WebSocket('ws://my.site.com');

ws.addEventListener('open', () => {
    ws.send('hello!');
});
```

### Configure

#### Default options

Options should be self explanatory

```javascript
const defaultOptions = {
    constructor: isGlobalWebSocket() ? WebSocket : null,
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1500,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: false,
};
```

#### Sample with custom options

```javascript
const WebSocket = require('reconnecting-websocket');

const options = {connectionTimeout: 1000};
const ws = new WebSocket('ws://my.site.com', [], options);
```

#### Manually closing

The `close` function has an additional options parameter

```javascript
close(code = 1000, reason = '', {keepClosed: boolean, fastClose: boolean, delay: number})
```

- Use the `keepClosed` option to keep the WebSocket closed or automatically reconnect (default `false`).
- If `fastClose` option is `true`, all close listeners are executed as soon as the close() method is called, otherwise it waits until the websocket closing protocol finishes, this can be a long time if there's no connection (default `true`). Keep in mind that with this option, it may happen that the close event is fired with a ready state of `CLOSING`.
- Use the `delay` option to set the initial delay for the next connection retry (ignored if `0`).

#### Setting WebSocket options

If you set any attributes of WebSocket itself, such as `binaryType`, make sure to set them again after each reconnection, i.e. on the `open` event:

```javascript
ws.addEventListener('open', () => {
    ws.binaryType = 'arraybuffer';
    ws.send('i am ready to receive some data!');
});
```

#### Using alternative constructor

This way you can use this module in cli/testing/node.js or use a decorated/alternative WebSocket. The only requisite is that the given constructor must be compatible with the [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

The example uses the [html5-websocket](https://github.com/pladaria/html5-websocket) module.

```javascript
const Html5WebSocket = require('html5-websocket');
const WebSocket = require('reconnecting-websocket');

const options = {constructor: Html5WebSocket};
const ws = new WebSocket('ws://my.site.com', null, options);
```

#### Max retries

When the max retries limit is reached, an error event with code `EHOSTDOWN` is emitted.

By default, `maxRetries` is set to `Infinity`.

```javascript
const WebSocket = require('reconnecting-websocket');

const ws = new WebSocket('ws://my.site.com', null, {maxRetries: 3});
ws.onerror = (err) => {
    if (err.code === 'EHOSTDOWN') {
        console.log('server down');
    }
};
```

## License

MIT
