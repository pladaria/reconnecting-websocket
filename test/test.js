const html5Websocket = require('html5-websocket');
const WebSocketServer = require('ws').Server;
const WebSocket = require('..');
const test = require('ava');

const options = {
    constructor: html5Websocket,
};

test('throws if no constructor is available', t => {
    t.throws(() => {
        new WebSocket('ws://foo.bar:1234', null, {constructor: null});
    }, TypeError);
});

test('throws if not created with `new`', t => {
    t.throws(() => {
        WebSocket('ws://foo.bar:1234', null, {constructor: html5Websocket});
    }, TypeError);
});

test.cb.only('connect, send, receive, close', t => {
    const wss = new WebSocketServer({port: 50000});
    console.log('init');

    wss.on('connection', (ws) => {
        console.log('server init');
        ws.on('message', (msg) => {
            ws.send(msg);
        });
    });

    const ws = new WebSocket('ws://localhost:50000', null, options);
    ws.addEventListener('open', () => {
        ws.send('hello');
    });
    ws.addEventListener('message', (msg) => {
        t.is(msg.data, 'hello');
        console.log(ws.readyState, ws.close);
        ws.close();
        wss.close();
        t.end();
    });

});
