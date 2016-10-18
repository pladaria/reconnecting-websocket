const Html5Websocket = require('html5-websocket');
const WebSocketServer = require('ws').Server;
const WebSocket = require('..');
const test = require('ava');
const PORT = 50123;
const PORT_UNRESPONSIVE = 50124;
const wsUrl = `ws://localhost:${PORT}`;

test('throws with invalid constructor', t => {
    t.throws(() => {
        new WebSocket(wsUrl, null);
    }, TypeError);
});

test('throws if not created with `new`', t => {
    t.throws(() => {
        WebSocket(wsUrl, null, {constructor: Html5Websocket});
    }, TypeError);
});

test.cb('global WebSocket is used if available', t => {
    t.plan(1);
    const saved = global.WebSocket;
    global.WebSocket = Html5Websocket;
    const ws = new WebSocket(wsUrl, null, {maxRetries: 0});
    ws.onerror = err => {
        if (err.code === 'EHOSTDOWN') {
            t.pass('WebSocket created');
            global.WebSocket = saved;
            t.end();
        }
    };
});

test('connection status constants', t => {
    const ws = new WebSocket(wsUrl, null, {constructor: Html5Websocket});
    t.is(ws.CONNECTING, 0);
    t.is(ws.OPEN, 1);
    t.is(ws.CLOSING, 2);
    t.is(ws.CLOSED, 3);
    ws.close();
});

test.cb('max retries', t => {
    const ws = new WebSocket(wsUrl, null, {
        constructor: Html5Websocket,
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

test.cb('level0 event listeners are reassigned after reconnect', t => {
    const ws = new WebSocket(wsUrl, null, {
        constructor: Html5Websocket,
        maxRetries: 4,
        reconnectionDelayFactor: 1.2,
        maxReconnectionDelay: 20,
        minReconnectionDelay: 10,
    });

    t.plan(26); // 5 ECONNREFUSED + 1 EHOSTDOWN + 5 * 4 t.is()
    const handleOpen = () => {};
    const handleMessage = () => {};
    const handleClose = () => {
        t.is(ws.onopen, handleOpen);
        t.is(ws.onclose, handleClose);
        t.is(ws.onmessage, handleMessage);
        t.is(ws.onerror, handleError);
    };
    const handleError = (err) => {
        t.pass();
        if (err.code === 'EHOSTDOWN') {
            t.end();
        }
    };

    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onmessage = handleMessage;
    ws.onerror = handleError;
});

test.cb('level0 event listeners are reassigned after closing with fastClose', t => {
    const rounds = 4;
    const wss = new WebSocketServer({port: PORT});
    const clientMsg = 'hello';
    const serverMsg = 'bye';

    t.plan(rounds * 7);

    wss.on('connection', ws => {
        ws.on('message', msg => {
            t.is(msg, clientMsg);
            ws.send(serverMsg);
        });
    });

    const ws = new WebSocket(wsUrl, null, {
        constructor: Html5Websocket,
        reconnectionDelayFactor: 1.2,
        maxReconnectionDelay: 20,
        minReconnectionDelay: 10,
    });

    let count = 0;
    const handleOpen = () => {
        ws.send(clientMsg);
        count++;
    };
    const handleMessage = (msg) => {
        t.is(msg.data, serverMsg);
        ws.close(1000, String(count), {keepClosed: count === rounds, fastClose: true});
        if (count === rounds) {
            wss.close();
            setTimeout(() => t.end(), 100);
        }
    };
    const handleClose = (event) => {
        t.is(ws.readyState, ws.CLOSING);
        t.is(ws.onopen, handleOpen);
        t.is(ws.onclose, handleClose);
        t.is(ws.onmessage, handleMessage);
        t.is(ws.onerror, handleError);
    };
    const handleError = () => {};

    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onmessage = handleMessage;
    ws.onerror = handleError;
});

test.cb('level2 event listeners (addEventListener, removeEventListener)', t => {
    const ws = new WebSocket(wsUrl, null, {
        constructor: Html5Websocket,
        maxRetries: 3,
        reconnectionDelayFactor: 1.2,
        maxReconnectionDelay: 60,
        minReconnectionDelay: 11,
    });

    t.plan(8);
    let count = 0;
    const handleClose1 = () => {
        count++;
        t.pass();
        if (count === 3) {
            ws.removeEventListener('close', handleClose1);
            ws.removeEventListener('close', handleClose2);
            ws.removeEventListener('close', handleClose1);
            ws.removeEventListener('close', handleClose2);
            ws.removeEventListener('bad', null);
            t.pass('no problem removing unexisting handlers');
        }
        if (count > 3) {
            t.fail('event listener not removed');
        }
    };

    const handleClose2 = () => {
        t.pass();
    };

    ws.addEventListener('close', handleClose1);
    ws.addEventListener('close', handleClose1);
    ws.addEventListener('close', handleClose2);
    ws.addEventListener('close', handleClose2);
    t.pass('adding the same handlers multiple times has no effect');

    ws.addEventListener('error', err => {
        if (err.code === 'EHOSTDOWN') {
            t.end();
        }
    });
});

test.cb('connection timeout', t => {
    const exec = require('child_process').exec;
    const proc = exec(`node unresponsive-server.js ${PORT_UNRESPONSIVE}`);

    proc.stdout.on('data', () => {
        const ws = new WebSocket(`ws://localhost:${PORT_UNRESPONSIVE}`, null, {
            constructor: Html5Websocket,
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
});

test.cb('connect, send, receive, close {fastClose: false}', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';

    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });

    const ws = new WebSocket(wsUrl, anyProtocol, {constructor: Html5Websocket});
    t.is(ws.readyState, ws.CONNECTING);
    t.is(ws.protocol, anyProtocol);

    ws.addEventListener('open', () => {
        t.is(ws.readyState, ws.OPEN);
        ws.send(anyMessageText);
    });

    ws.addEventListener('message', msg => {
        t.is(msg.data, anyMessageText);
        ws.close(1000, '', {fastClose: false, keepClosed: true});
        wss.close();
        t.is(ws.readyState, ws.CLOSING);
    });

    ws.addEventListener('close', () => {
        t.is(ws.readyState, ws.CLOSED);
        t.is(ws.url, wsUrl);
        t.end();
    });
});

test.cb('connect, send, receive, close {fastClose: true}', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';
    const closeCode = 1000;
    const closeReason = 'normal';

    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });

    const ws = new WebSocket(wsUrl, anyProtocol, {constructor: Html5Websocket});

    t.plan(9);

    t.is(ws.readyState, ws.CONNECTING);
    t.is(ws.protocol, anyProtocol);

    ws.addEventListener('open', () => {
        t.is(ws.readyState, ws.OPEN);
        ws.send(anyMessageText);
    });

    ws.addEventListener('message', msg => {
        t.is(msg.data, anyMessageText);
        ws.close(closeCode, closeReason, {fastClose: true, keepClosed: true});
        wss.close();
    });

    ws.addEventListener('close', () => {
        t.is(ws.readyState, ws.CLOSING);
        t.is(ws.url, wsUrl);
    });

    ws.onclose = (event) => {
        t.is(ws.readyState, ws.CLOSING);
        t.is(event.code, closeCode);
        t.is(event.reason, closeReason);
        t.end();
    };
});

test.cb('close and keepClosed', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';
    const maxRetries = 3;

    let timesOpened = 0;
    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', ws => {
        ws.on('close', (event) => {
            if (timesOpened === maxRetries) {
                setTimeout(() => {
                    wss.close();
                    t.end();
                }, 100);
            }
            if (timesOpened > maxRetries) {
                t.fail('closed too many times');
            }
        });
    });

    const ws = new WebSocket(wsUrl, anyProtocol, {
        constructor: Html5Websocket,
        maxReconnectionDelay: 0,
        minReconnectionDelay: 0,
    });
    t.is(ws.readyState, ws.CONNECTING);
    t.is(ws.protocol, anyProtocol);

    ws.addEventListener('open', () => {
        timesOpened++;
        t.is(ws.readyState, ws.OPEN, timesOpened);
        const keepClosed = timesOpened >= maxRetries;
        ws.close(1000, 'closed', {keepClosed, delay: 1, fastClose: false});
    });

    ws.addEventListener('close', () => {
        t.is(ws.readyState, ws.CLOSED);
        t.is(ws.url, wsUrl);
    });
});

test.cb('debug mode logs stuff', t => {
    const savedLog = console.log;
    let callsCount = 0;
    console.log = () => {
        callsCount++;
    };
    const ws = new WebSocket(wsUrl, null, {
        constructor: Html5Websocket,
        maxRetries: 0,
        debug: true,
    });
    ws.onerror = err => {
        if (err.code === 'EHOSTDOWN') {
            t.true(callsCount > 0, `calls to console.log: ${callsCount}`);
            t.end();
            console.log = savedLog;
        }
    };
});
