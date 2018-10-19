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

test.cb('websocket protocol', t => {
    const anyProtocol = 'foobar';
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, anyProtocol, {
        // minReconnectionDelay: 100,
        // maxReconnectionDelay: 200,
    });

    ws.addEventListener('open', () => {
        t.is(ws.url, URL);
        t.is(ws.protocol, anyProtocol);
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            setTimeout(() => {
                t.end();
            }, 500);
        });
    });
});

test.cb('undefined websocket protocol', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {});

    ws.addEventListener('open', () => {
        t.is(ws.url, URL);
        t.is(ws.protocol, '');
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            setTimeout(() => {
                t.end();
            }, 500);
        });
    });
});

test.cb('null websocket protocol', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, null, {});

    ws.addEventListener('open', () => {
        t.is(ws.url, URL);
        t.is(ws.protocol, '');
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            setTimeout(() => {
                t.end();
            }, 100);
        });
    });
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
        reconnectionDelayGrowFactor: 1.2,
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
        wss.close(() => {
            setTimeout(() => t.end(), 500);
        });
    });
});

// https://developer.mozilla.org/en-US/docs/Web/API/EventListener/handleEvent
test.cb('level2 event listeners using object with handleEvent', t => {
    const anyProtocol = 'foobar';
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, anyProtocol, {});

    ws.addEventListener('open', {
        handleEvent: () => {
            t.is(ws.protocol, anyProtocol);
            t.is(ws.extensions, '');
            t.is(ws.bufferedAmount, 0);
            ws.close();
        },
    });

    const fail = {
        handleEvent: () => {
            t.fail();
        },
    };
    ws.addEventListener('unknown1', fail);
    ws.addEventListener('open', fail);
    ws.addEventListener('open', fail);
    ws.removeEventListener('open', fail);
    ws.removeEventListener('unknown2', fail);

    ws.addEventListener('close', {
        handleEvent: () => {
            wss.close();
            setTimeout(() => t.end(), 500);
        },
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

test.cb('immediately-failed connection should not timeout', t => {
    const ws = new ReconnectingWebSocket('ws://thiswillfail.com', null, {
        maxRetries: 2,
        connectionTimeout: 500,
    });

    ws.addEventListener('error', err => {
        if (err.message === 'TIMEOUT') {
            t.fail();
        }
        if (ws.retryCount === 2) {
            setTimeout(() => t.end(), 1500);
        }
        if (ws.retryCount > 2) {
            t.fail();
        }
    });
});

test.cb('immediately-failed connection with 0 maxRetries must not retry', t => {
    const ws = new ReconnectingWebSocket('ws://thiswillfail.com', [], {
        maxRetries: 0,
        connectionTimeout: 500,
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });

    let i = 0;
    ws.addEventListener('error', err => {
        i++;
        if (err.message === 'TIMEOUT') {
            t.fail();
        }
        if (i > 1) {
            t.fail();
        }
        setTimeout(() => {
            t.end();
        }, 500);
    });
});

test.cb('connect and close before establishing connection', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });

    ws.close(); // closing before establishing connection

    ws.addEventListener('open', () => {
        t.fail('open never called');
    });

    let closeCount = 0;
    ws.addEventListener('close', () => {
        closeCount++;
        if (closeCount > 1) {
            t.fail('close should be called once');
        }
    });

    setTimeout(() => {
        // wait a little to be sure no unexpected open or close events happen
        wss.close();
        t.end();
    }, 1000);
});

test.cb('enqueue messages', t => {
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
    });
    const count = 10;
    const message = 'message';
    for (let i = 0; i < count; i++) ws.send('message');

    ws.onerror = () => {
        t.is(ws.bufferedAmount, message.length * count);
        t.pass();
        t.end();
    };
});

test.cb('enqueue messages before websocket initialization with expected order', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL);

    const messages = ['message1', 'message2', 'message3'];

    messages.forEach(m => ws.send(m));
    t.is(ws._messageQueue.length, messages.length);

    t.is(ws.bufferedAmount, messages.reduce((a, m) => a + m.length, 0));

    let i = 0;
    wss.on('connection', client => {
        client.on('message', data => {
            if (data === 'ok') {
                t.is(i, messages.length, 'enqueued messages are sent first');
                ws.close();
            } else {
                t.is(data, messages[i]);
                i++;
            }
        });
    });

    ws.addEventListener('open', () => {
        ws.send('ok');
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            t.end();
        });
    });
});

test.cb('closing from the other side should reconnect', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });

    let max = 3;
    let i = 0;
    wss.on('connection', client => {
        i++;
        if (i < max) {
            t.pass('closing client from server side should trigger a reconnection');
            setTimeout(() => client.close(), 100);
        }
        if (i === max) {
            // will close from client side
        }
        if (i > max) {
            t.fail('unexpected connection');
        }
    });

    let j = 0;
    ws.addEventListener('open', () => {
        j++;
        if (j === max) {
            ws.close();
            // wait a little to ensure no new connections are opened
            setTimeout(() => {
                wss.close(() => {
                    t.end();
                });
            }, 500);
        }
        if (j > max) {
            t.fail('unexpected open');
        }
    });
});

test.cb('closing from the other side should allow to keep closed', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });

    const codes = [4000, 4001];

    let i = 0;
    wss.on('connection', client => {
        if (i > codes.length) {
            t.fail();
        }
        client.close(codes[i], String(codes[i]));
        i++;
    });

    let j = 0;
    ws.addEventListener('close', e => {
        if (e.code === codes[0]) {
            // do nothing, will reconnect
        }
        if (e.code === codes[1] && e.reason === String(codes[1])) {
            // close connection (and keep closed)
            ws.close();
            setTimeout(() => {
                wss.close(() => t.end());
            }, 1000);
        }
    });
});

test.cb('reconnection delay grow factor', t => {
    const ws = new ReconnectingWebSocket('wss://bad.url', [], {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 2,
    });
    const expected = [100, 200, 400, 800, 1000, 1000];
    let retry = 0;
    ws.addEventListener('error', e => {
        t.is(ws._getNextDelay(), expected[retry]);
        retry++;
        if (retry >= expected.length) {
            ws.close();
            setTimeout(() => {
                t.end();
            }, 2000);
        }
    });
});

test.cb('minUptime', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, [], {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 2000,
        reconnectionDelayGrowFactor: 2,
        minUptime: 500,
    });
    const expectedDelays = [100, 200, 400, 800, 100, 100];
    const expectedRetryCount = [1, 2, 3, 4, 1, 1];
    let connectionCount = 0;
    wss.on('connection', client => {
        connectionCount++;
        if (connectionCount <= expectedDelays.length) {
            setTimeout(() => {
                client.close();
            }, connectionCount * 100);
        }
    });
    let openCount = 0;
    ws.addEventListener('open', e => {
        openCount++;
        if (openCount > expectedDelays.length) {
            ws.close();
            wss.close(() => {
                setTimeout(() => {
                    t.end();
                }, 1000);
            });
        }
    });
    let closeCount = 0;
    ws.addEventListener('close', () => {
        if (closeCount < expectedDelays.length) {
            t.is(ws._getNextDelay(), expectedDelays[closeCount]);
            t.is(ws._retryCount, expectedRetryCount[closeCount]);
            closeCount++;
        }
    });
});

test.cb('reconnect after closing', t => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {
        minReconnectionDelay: 100,
        maxReconnectionDelay: 200,
    });

    let i = 0;
    ws.addEventListener('open', () => {
        i++;
        if (i === 1) {
            ws.close();
        }
        if (i === 2) {
            ws.close();
        }
        if (i > 2) {
            t.fail('no more reconnections expected');
        }
    });

    ws.addEventListener('close', () => {
        if (i === 1)
            setTimeout(() => {
                ws.reconnect();
            }, 1000);
        if (i === 2) {
            wss.close(() => {
                setTimeout(() => {
                    t.end();
                }, 1000);
            });
        }
        if (i > 2) {
            t.fail('no more reconnections expected');
        }
    });
});

// test.cb('reconnect after closing', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     ws.addEventListener('open', () => {});

//     ws.addEventListener('close', () => {});
// });
