const test = require('ava');
const {spawn} = require('child_process');
const WebSocket = require('ws');
const WebSocketServer = require('ws').Server;
const ReconnectingWebSocket = require('..');

const PORT = 50123;
const PORT_UNRESPONSIVE = 50124;
const URL = `ws://localhost:${PORT}`;

test.beforeEach(() => {
    global.WebSocket = WebSocket;
});

test.afterEach(() => {
    delete global.WebSocket;
});

test('throws with invalid constructor', t => {
    delete global.WebSocket;
    t.throws(() => {
        new ReconnectingWebSocket(URL, undefined, {WebSocket: 123});
    });
});

test('throws with missing constructor', t => {
    delete global.WebSocket;
    t.throws(() => {
        new ReconnectingWebSocket(URL, undefined);
    });
});

test('throws if not created with `new`', t => {
    t.throws(() => {
        ReconnectingWebSocket(URL, undefined);
    }, TypeError);
});

test.cb('global WebSocket is used if available', t => {
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
    });
    ws.onerror = () => {
        t.true(ws._ws instanceof WebSocket);
        t.end();
    };
});

test.cb('send is ignored when not ready', t => {
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
    });
    ws.send('message');
    ws.onerror = () => {
        t.pass();
        t.end();
    };
});

test.cb('getters when not ready', t => {
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
    });
    t.is(ws.bufferedAmount, 0);
    t.is(ws.protocol, '');
    t.is(ws.url, '');
    t.is(ws.extensions, '');
    t.is(ws.binaryType, 'blob');

    ws.onerror = () => {
        t.pass();
        t.end();
    };
});

test.cb('debug', t => {
    const log = console.log;
    console.log = () => t.pass();

    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
        debug: true,
    });

    ws.onerror = () => {
        ws._options.debug = false;
        console.log = log;
        t.end();
    };
});

test.cb('pass WebSocket via options', t => {
    delete global.WebSocket;
    const ws = new ReconnectingWebSocket(URL, undefined, {
        WebSocket,
        maxRetries: 0,
    });
    ws.onerror = () => {
        t.true(ws._ws instanceof WebSocket);
        t.end();
    };
});

test('URL provider', async t => {
    const url = 'example.com';
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
    });
    t.is(await ws._getNextUrl(url), url, 'string');
    t.is(await ws._getNextUrl(() => url), url, '() -> string');
    t.is(await ws._getNextUrl(() => Promise.resolve(url)), url, '() -> Promise<string>');

    try {
        await ws._getNextUrl(123);
        t.fail();
    } catch (e) {
        t.pass();
    }

    try {
        await ws._getNextUrl(() => 123);
        t.fail();
    } catch (e) {
        t.pass();
    }
});

test('connection status constants', t => {
    const ws = new ReconnectingWebSocket(URL, null, {maxRetries: 0});

    t.is(ReconnectingWebSocket.CONNECTING, 0);
    t.is(ReconnectingWebSocket.OPEN, 1);
    t.is(ReconnectingWebSocket.CLOSING, 2);
    t.is(ReconnectingWebSocket.CLOSED, 3);

    t.is(ws.CONNECTING, 0);
    t.is(ws.OPEN, 1);
    t.is(ws.CLOSING, 2);
    t.is(ws.CLOSED, 3);
    ws.close();
});

const maxRetriesTest = (count, t) => {
    const ws = new ReconnectingWebSocket(URL, null, {
        maxRetries: count,
        maxReconnectionDelay: 200,
    });
    t.plan(count + 1);

    ws.addEventListener('error', event => {
        t.pass();
        if (ws.retryCount === count) {
            setTimeout(() => t.end(), 500);
        }
        if (ws.retryCount > count) {
            t.fail(`too many retries: ${ws.retryCount}`);
        }
    });
};

test.cb('max retries: 0', t => maxRetriesTest(0, t));
test.cb('max retries: 1', t => maxRetriesTest(1, t));
test.cb('max retries: 5', t => maxRetriesTest(5, t));

test.cb('level0 event listeners are kept after reconnect', t => {
    const ws = new ReconnectingWebSocket(URL, null, {
        maxRetries: 4,
        reconnectionDelayFactor: 1.2,
        maxReconnectionDelay: 20,
        minReconnectionDelay: 10,
    });

    const handleOpen = () => {};
    const handleClose = () => {};
    const handleMessage = () => {};
    const handleError = () => {
        t.is(ws.onopen, handleOpen);
        t.is(ws.onclose, handleClose);
        t.is(ws.onmessage, handleMessage);
        t.is(ws.onerror, handleError);
        if (ws.retryCount === 4) {
            t.end();
        }
    };

    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onmessage = handleMessage;
    ws.onerror = handleError;
});

test.cb('level2 event listeners', t => {
    const anyProtocol = 'foobar';
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, anyProtocol, {});

    ws.addEventListener('open', () => {
        t.is(ws.protocol, anyProtocol);
        t.is(ws.extensions, '');
        t.is(ws.bufferedAmount, 0);
        ws.close();
    });

    const fail = () => {
        t.fail();
    };
    ws.addEventListener('unknown1', fail);
    ws.addEventListener('open', fail);
    ws.addEventListener('open', fail);
    ws.removeEventListener('open', fail);
    ws.removeEventListener('unknown2', fail);

    ws.addEventListener('close', () => {
        wss.close();
        setTimeout(() => t.end(), 500);
    });
});

test.cb('connection timeout', t => {
    const proc = spawn('node', [`${__dirname}/unresponsive-server.js`, PORT_UNRESPONSIVE, 5000]);
    t.plan(2);

    let lock = false;
    proc.stdout.on('data', d => {
        if (lock) return;
        lock = true;

        const ws = new ReconnectingWebSocket(`ws://localhost:${PORT_UNRESPONSIVE}`, null, {
            minReconnectionDelay: 50,
            connectionTimeout: 500,
            maxRetries: 1,
        });

        ws.addEventListener('error', event => {
            t.is(event.message, 'TIMEOUT');
            if (ws.retryCount === 1) {
                setTimeout(() => t.end(), 1000);
            }
        });

        ws.addEventListener('close', event => {
            console.log('>>>> CLOSE', event.message);
        });
    });
});

test.cb('getters', t => {
    const anyProtocol = 'foobar';
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, anyProtocol, {maxReconnectionDelay: 100});

    ws.addEventListener('open', () => {
        t.is(ws.protocol, anyProtocol);
        t.is(ws.extensions, '');
        t.is(ws.bufferedAmount, 0);
        t.is(ws.binaryType, 'nodebuffer');
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close();
        setTimeout(() => t.end(), 500);
    });
});

test.cb('binaryType', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {minReconnectionDelay: 0});

    t.is(ws.binaryType, 'blob');
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => {
        t.is(ws.binaryType, 'arraybuffer', 'assigned after open');
        ws.binaryType = 'nodebuffer';
        t.is(ws.binaryType, 'nodebuffer');
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close();
        setTimeout(() => t.end(), 500);
    });
});

test.cb('calling to close multiple times', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {});

    ws.addEventListener('open', () => {
        ws.close();
        ws.close();
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close();
        setTimeout(() => t.end(), 500);
    });
});

test.cb('calling to reconnect when not ready', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {});
    ws.reconnect();
    ws.reconnect();

    ws.addEventListener('open', () => {
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close();
        setTimeout(() => t.end(), 500);
    });
});

test.cb('connect, send, receive, close', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';

    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });
    wss.on('error', () => {
        t.fail();
    });

    t.plan(7);

    const ws = new ReconnectingWebSocket(URL, anyProtocol, {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });
    t.is(ws.readyState, ws.CONNECTING);

    ws.addEventListener('open', () => {
        t.is(ws.protocol, anyProtocol);
        t.is(ws.readyState, ws.OPEN);
        ws.send(anyMessageText);
    });

    ws.addEventListener('message', msg => {
        t.is(msg.data, anyMessageText);
        ws.close(1000, '');
        t.is(ws.readyState, ws.CLOSING);
    });

    ws.addEventListener('close', () => {
        t.is(ws.readyState, ws.CLOSED);
        t.is(ws.url, URL);
        wss.close();
        setTimeout(() => t.end(), 1000);
    });
});

test.cb('connect, send, receive, reconnect', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';

    const wss = new WebSocketServer({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });

    const totalRounds = 3;
    let currentRound = 0;

    // 6 = 3 * 2 open
    // 8 = 2 * 3 message + 2 reconnect
    // 7 = 2 * 3 close + 1 closed
    t.plan(21);

    const ws = new ReconnectingWebSocket(URL, anyProtocol, {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });

    ws.onopen = () => {
        currentRound++;
        t.is(ws.protocol, anyProtocol);
        t.is(ws.readyState, ws.OPEN);
        ws.send(anyMessageText);
    };

    ws.onmessage = msg => {
        t.is(msg.data, anyMessageText);
        if (currentRound < totalRounds) {
            ws.reconnect(1000, 'reconnect');
            t.is(ws.retryCount, 0);
        } else {
            ws.close(1000, 'close');
        }
        t.is(ws.readyState, ws.CLOSING);
    };

    ws.addEventListener('close', event => {
        t.is(ws.url, URL);
        if (currentRound >= totalRounds) {
            t.is(ws.readyState, ws.CLOSED);
            wss.close();
            setTimeout(() => t.end(), 1000);
            t.is(event.reason, 'close');
        } else {
            t.is(event.reason, 'reconnect');
        }
    });
});
