# Reconnecting WebSocket

WebSocket that will automatically reconnect if the connection is closed.

# WORK IN PROGRESS

Please do not use for production :(

## Features

- Small (~150 LOC)
- WebSocket API compatible (same interface DOM1, DOM2 event model) - **WIP**
- Fully configurable
- Multiplatform (Web, ServiceWorkers, Node.js, React Native)
- Dependency free (does not depends on Window, DOM or any EventEmitter library)
- Reassign event listeners when a new WebSocket instance is created
- Automatic reconnection using rfc6455 guidelines
- Handle connection timeouts
- Full test coverage - **WIP**
- Debug mode

## Install

```bash
npm install --save reconnecting-websocket
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

Options should be self explainatory

```javascript
const DEFAULT_OPTIONS = {
    constructor: (typeof WebSocket === 'function') ? WebSocket : null,
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
const ws = new WebSocket('ws://my.site.com', null, options);
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

## License

MIT
