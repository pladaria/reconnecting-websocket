const html5Websocket = require('html5-websocket');
const WebSocketServer = require('ws').Server;
const WebSocket = require('..');
const test = require('ava');
const PORT = 50000;

const BASE_OPTIONS = {
    constructor: html5Websocket,
    debug: false,
};

test('throws with invalid constructor', t => {
    t.throws(() => {
        new WebSocket('ws://foo.bar:1234', null, {constructor: null});
    }, TypeError);
});

test('throws if not created with `new`', t => {
    t.throws(() => {
        WebSocket('ws://foo.bar:1234', null, {constructor: html5Websocket});
    }, TypeError);
});

test('connection status constants', t => {
    const ws = new WebSocket('ws://localhost:1234', null, BASE_OPTIONS);
    t.is(ws.CONNECTING, 0);
    t.is(ws.OPEN, 1);
    t.is(ws.CLOSING, 2);
    t.is(ws.CLOSED, 3);
    ws.close();
});

test.cb('happy case: connect, send, receive, close', t => {
    const anyMessageText = 'hello';
    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', (ws) => {
        ws.on('message', (msg) => {
            ws.send(msg);
        });
    });

    const ws = new WebSocket(`ws://localhost:${PORT}`, null, BASE_OPTIONS);
    t.is(ws.readyState, ws.CONNECTING);
    ws.addEventListener('open', () => {
        t.is(ws.readyState, ws.OPEN);
        ws.send(anyMessageText);
    });
    ws.addEventListener('message', (msg) => {
        t.is(msg.data, anyMessageText);
        ws.close();
        wss.close();
        t.is(ws.readyState, ws.CLOSING);
    });
    ws.addEventListener('close', () => {
        t.is(ws.readyState, ws.CLOSED);
        t.end();
    });
});
