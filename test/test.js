const HWS = require('html5-websocket');
const WSS = require('ws').Server;
const RWS = require('..');
const test = require('ava');
const PORT = 50123;
const PORT_UNRESPONSIVE = 50124;
const url = `ws://localhost:${PORT}`;

test('throws with invalid constructor', t => {
    t.throws(() => {
        new RWS(url, null);
    }, TypeError);
});

test('throws if not created with `new`', t => {
    t.throws(() => {
        RWS(url, null, {constructor: HWS});
    }, TypeError);
});

test.cb('global WebSocket is used if available', t => {
    t.plan(1);
    const saved = global.WebSocket;
    global.WebSocket = HWS;
    const ws = new RWS(url, null, {maxRetries: 0});
    ws.onerror = err => {
        if (err.code === 'EHOSTDOWN') {
            t.pass('WebSocket created');
            global.WebSocket = saved;
            t.end();
        }
    };
});

test.cb('url provider', t => {
    t.plan(1);
    const wss = new WSS({port: PORT});

    const getUrl = () => url;
    const ws = new RWS(getUrl, null, {maxRetries: 0, constructor: HWS});

    ws.onopen = () => {
        t.pass('Connected');
        ws.close(1000, '', {keepClosed: true});
        wss.close();
        t.end();
    }
});

test('connection status constants', t => {
    const ws = new RWS(url, null, {constructor: HWS});
    t.is(ws.CONNECTING, 0);
    t.is(ws.OPEN, 1);
    t.is(ws.CLOSING, 2);
    t.is(ws.CLOSED, 3);
    ws.close();
});

test.cb('max retries', t => {
    const ws = new RWS(url, null, {
        constructor: HWS,
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
    const ws = new RWS(url, null, {
        constructor: HWS,
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
    const wss = new WSS({port: PORT});
    const clientMsg = 'hello';
    const serverMsg = 'bye';

    t.plan(rounds * 7);

    wss.on('connection', ws => {
        ws.on('message', msg => {
            t.is(msg, clientMsg);
            ws.send(serverMsg);
        });
    });

    const ws = new RWS(url, null, {
        constructor: HWS,
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
    const handleClose = () => {
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
    const ws = new RWS(url, null, {
        constructor: HWS,
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

test.skip.cb('connection timeout', t => {
    const spawn = require('child_process').spawn;
    const proc = spawn('node', [`${__dirname}/unresponsive-server.js`, String(PORT_UNRESPONSIVE)]);

    proc.stderr.on('data', (data) => {
        t.fail(data.toString());
    });

    proc.stdout.on('data', () => {
        const ws = new RWS(`ws://localhost:${PORT_UNRESPONSIVE}`, null, {
            constructor: HWS,
            connectionTimeout: 100,
            maxRetries: 0,
        });

        t.plan(2);
        ws.addEventListener('close', () => {
            t.pass();
        });
        ws.addEventListener('error', err => {
            if (err.code === 'ETIMEDOUT') {
                t.pass();
                t.end();
            }
        });
    });
});

test.cb('immediatly-failed connection should not timeout', (t) => {
    const ws = new RWS('ws://thiswillfail.com', null, {
        constructor: HWS,
        maxRetries: 2,
        connectionTimeout: 500,
    });

    ws.addEventListener('error', (err) => {
        console.log(err.code);
        if (err.code === 'ETIMEDOUT') {
            t.fail();
            t.end();
        }
        if (err.code === 'EHOSTDOWN') {
            t.end();
        }
    });
})

test.cb('connect, send, receive, close {fastClose: false}', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';

    const wss = new WSS({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });

    const ws = new RWS(url, anyProtocol, {constructor: HWS});
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
        t.is(ws.url, url);
        wss.close();
        t.end();
    });
});

test.cb('connect, send, receive, close {fastClose: true}', t => {
    const anyMessageText = 'hello';
    const anyProtocol = 'foobar';
    const closeCode = 1000;
    const closeReason = 'normal';

    const wss = new WSS({port: PORT});
    wss.on('connection', ws => {
        ws.on('message', msg => {
            ws.send(msg);
        });
    });

    const ws = new RWS(url, anyProtocol, {constructor: HWS});

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
        t.is(ws.url, url);
    });

    ws.onclose = (event) => {
        t.is(ws.readyState, ws.CLOSING);
        t.is(event.code, closeCode);
        t.is(event.reason, closeReason);
        t.end();
    };
});

test.cb('close and keepClosed', t => {
    const anyProtocol = 'foobar';
    const maxRetries = 3;

    let timesOpened = 0;
    const wss = new WSS({port: PORT});
    wss.on('connection', ws => {
        ws.on('close', () => {
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

    const ws = new RWS(url, anyProtocol, {
        constructor: HWS,
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
        t.is(ws.url, url);
    });
});

test.cb('debug mode logs stuff', t => {
    const savedLog = global.console.log;
    let callsCount = 0;
    global.console.log = () => {
        callsCount++;
    };
    const ws = new RWS(url, null, {
        constructor: HWS,
        maxRetries: 0,
        debug: true,
    });
    ws.onerror = err => {
        if (err.code === 'EHOSTDOWN') {
            t.true(callsCount > 0, `calls to console.log: ${callsCount}`);
            t.end();
            global.console.log = savedLog;
        }
    };
});

test.cb('#14 fix - closing with keepClose before open', t => {
    const wss = new WSS({port: PORT});
    let connectionsCount = 0;

    wss.on('connection', ws => {
        connectionsCount++;
        if (connectionsCount > 1) {
            t.fail('only one connection was expected');
            wss.close();
        }
        wss.close(4000);
    });

    const ws = new RWS(url, undefined, {
        constructor: HWS,
        maxReconnectionDelay: 300,
        minReconnectionDelay: 300,
        reconnectionDelayGrowFactor: 1,
    });

    const closeHandler = () => {
        ws.removeEventListener('close', closeHandler);
        ws.close(4000, undefined, {keepClosed: true, fastClose: true});
    };

    ws.addEventListener('close', closeHandler);

    setTimeout(() => {
        t.pass('no new connections after delay');
        wss.close();
        t.end();
    }, 1000);
});
