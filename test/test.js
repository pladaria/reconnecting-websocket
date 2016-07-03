//const net = require('net');
const html5Websocket = require('html5-websocket');
const WebSocketServer = require('ws').Server;
const WebSocket = require('..');
const test = require('ava');
const PORT = 50000;
const wsUrl = `ws://localhost:${PORT}`;

test('throws with invalid constructor', t => {
    t.throws(() => {
        new WebSocket(wsUrl, null, {constructor: null});
    }, TypeError);
});

test('throws if not created with `new`', t => {
    t.throws(() => {
        WebSocket(wsUrl, null, {constructor: html5Websocket});
    }, TypeError);
});

test('connection status constants', t => {
    const ws = new WebSocket(wsUrl, null, {constructor: html5Websocket});
    t.is(ws.CONNECTING, 0);
    t.is(ws.OPEN, 1);
    t.is(ws.CLOSING, 2);
    t.is(ws.CLOSED, 3);
    ws.close();
});

test.cb('max retries', t => {
    const ws = new WebSocket(wsUrl, null, {
        constructor: html5Websocket,
        maxRetries: 2,
        reconnectionDelayFactor: 0,
        maxReconnectionDelay: 0,
        minReconnectionDelay: 0,
    });
    t.plan(6);
    ws.addEventListener('close', () => {
        t.pass();
    });
    ws.addEventListener('error', err => {
        if (err.code === 'ECONNREFUSED') {
            t.pass();
        }
        if (err.code === 'EHOSTDOWN') {
            t.end();
        }
    });
});

test.cb('connection timeout', t => {
    const timeoutWsUrl = `ws://8.8.8.8`;
    const ws = new WebSocket(timeoutWsUrl, null, {
        constructor: html5Websocket,
        connectionTimeout: 200,
        maxRetries: 0,
    });

    t.plan(3);
    ws.addEventListener('close', () => {
        t.pass();
    });
    ws.addEventListener('error', err => {
        if (err.code === 'EHOSTDOWN') {
            t.pass();
            t.end();
        }
        if (err.code === 'ETIMEDOUT') {
            t.pass();
        }
    });
});

test.cb('happy case: connect, send, receive, close', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';

    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });

    const ws = new WebSocket(wsUrl, anyProtocol, {constructor: html5Websocket});
    t.is(ws.readyState, ws.CONNECTING);
    t.is(ws.protocol, anyProtocol);

    ws.addEventListener('open', () => {
        t.is(ws.readyState, ws.OPEN);
        ws.send(anyMessageText);
    });

    ws.addEventListener('message', msg => {
        t.is(msg.data, anyMessageText);
        ws.close();
        wss.close();
        t.is(ws.readyState, ws.CLOSING);
    });

    ws.addEventListener('close', () => {
        t.is(ws.readyState, ws.CLOSED);
        t.is(ws.url, wsUrl);
        t.end();
    });
});
