// const {spawn} = require('child_process');
// @ts-ignore
import WebSocket from 'ws';
import ReconnectingWebSocket from '../reconnecting-websocket';
const WebSocketServer = WebSocket.Server;

const PORT = 50123;
// const PORT_UNRESPONSIVE = 50124;
const URL = `ws://localhost:${PORT}`;

beforeEach(() => {
    (global as any).WebSocket = WebSocket;
});

afterEach(() => {
    delete (global as any).WebSocket;
    jest.restoreAllMocks();
});

test('throws with invalid constructor', () => {
    delete (global as any).WebSocket;
    expect(() => {
        new ReconnectingWebSocket(URL, undefined, {WebSocket: 123, maxRetries: 0});
    }).toThrow();
});

test('throws with missing constructor', () => {
    delete (global as any).WebSocket;
    expect(() => {
        new ReconnectingWebSocket(URL, undefined, {maxRetries: 0});
    }).toThrow();
});

test('throws with non-constructor object', () => {
    (global as any).WebSocket = {};
    expect(() => {
        new ReconnectingWebSocket(URL, undefined, {maxRetries: 0});
    }).toThrow();
});

test('throws if not created with `new`', () => {
    expect(() => {
        // @ts-ignore
        ReconnectingWebSocket(URL, undefined);
    }).toThrow(TypeError);
});

test('global WebSocket is used if available', done => {
    // @ts-ignore
    const ws = new ReconnectingWebSocket(URL, undefined, {maxRetries: 0});
    ws.onerror = () => {
        // @ts-ignore
        expect(ws._ws instanceof WebSocket).toBe(true);
        done();
    };
});

test('getters when not ready', done => {
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: 0,
    });
    expect(ws.bufferedAmount).toBe(0);
    expect(ws.protocol).toBe('');
    expect(ws.url).toBe('');
    expect(ws.extensions).toBe('');
    expect(ws.binaryType).toBe('blob');

    ws.onerror = () => {
        done();
    };
});

test('debug on', done => {
    const logSpy = jest.spyOn(console, 'log').mockReturnValue();

    const ws = new ReconnectingWebSocket(URL, undefined, {maxRetries: 0, debug: true});

    ws.onerror = () => {
        expect(logSpy).toHaveBeenCalledWith('RWS>', 'connect', 0);
        done();
    };
});

test('debug off', done => {
    const logSpy = jest.spyOn(console, 'log').mockReturnValue();

    const ws = new ReconnectingWebSocket(URL, undefined, {maxRetries: 0});

    ws.onerror = () => {
        expect(logSpy).not.toHaveBeenCalled();
        done();
    };
});

test('pass WebSocket via options', done => {
    delete (global as any).WebSocket;
    const ws = new ReconnectingWebSocket(URL, undefined, {
        WebSocket,
        maxRetries: 0,
    });
    ws.onerror = () => {
        // @ts-ignore - accessing private property
        expect(ws._ws instanceof WebSocket).toBe(true);
        done();
    };
});

test('URL provider', async () => {
    const url = 'example.com';
    const ws = new ReconnectingWebSocket(URL, undefined, {maxRetries: 0});

    // @ts-ignore - accessing private property
    expect(await ws._getNextUrl(url)).toBe(url);

    // @ts-ignore - accessing private property
    expect(await ws._getNextUrl(() => url)).toBe(url);

    // @ts-ignore - accessing private property
    expect(await ws._getNextUrl(() => Promise.resolve(url))).toBe(url);

    // @ts-ignore - accessing private property
    expect(() => ws._getNextUrl(123)).toThrow();

    // @ts-ignore - accessing private property
    expect(() => ws._getNextUrl(() => 123)).toThrow();
});

test('websocket protocol', done => {
    const anyProtocol = 'foobar';
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, anyProtocol);

    ws.addEventListener('open', () => {
        expect(ws.url).toBe(URL);
        expect(ws.protocol).toBe(anyProtocol);
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            setTimeout(done, 500);
        });
    });
});

test('undefined websocket protocol', done => {
    const wss = new WebSocketServer({port: PORT});
    const ws = new ReconnectingWebSocket(URL, undefined, {});

    ws.addEventListener('open', () => {
        expect(ws.url).toBe(URL);
        expect(ws.protocol).toBe('');
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            setTimeout(done, 500);
        });
    });
});

test('null websocket protocol', done => {
    const wss = new WebSocketServer({port: PORT});

    // @ts-ignore - null is not allowed but could be passed in vanilla js
    const ws = new ReconnectingWebSocket(URL, null, {});
    ws.addEventListener('open', () => {
        expect(ws.url).toBe(URL);
        expect(ws.protocol).toBe('');
        ws.close();
    });

    ws.addEventListener('close', () => {
        wss.close(() => {
            setTimeout(done, 100);
        });
    });
});

test('connection status constants', () => {
    const ws = new ReconnectingWebSocket(URL, undefined, {maxRetries: 0});

    expect(ReconnectingWebSocket.CONNECTING).toBe(0);
    expect(ReconnectingWebSocket.OPEN).toBe(1);
    expect(ReconnectingWebSocket.CLOSING).toBe(2);
    expect(ReconnectingWebSocket.CLOSED).toBe(3);

    expect(ws.CONNECTING).toBe(0);
    expect(ws.OPEN).toBe(1);
    expect(ws.CLOSING).toBe(2);
    expect(ws.CLOSED).toBe(3);
    ws.close();
});

const maxRetriesTest = (count: number, done: () => void) => {
    const ws = new ReconnectingWebSocket(URL, undefined, {
        maxRetries: count,
        maxReconnectionDelay: 200,
    });

    ws.addEventListener('error', () => {
        if (ws.retryCount === count) {
            setTimeout(done, 500);
        }
        if (ws.retryCount > count) {
            throw Error(`too many retries: ${ws.retryCount}`);
        }
    });
};

test('max retries: 0', done => maxRetriesTest(0, done));
test('max retries: 1', done => maxRetriesTest(1, done));
test('max retries: 5', done => maxRetriesTest(5, done));

// test('level0 event listeners are kept after reconnect', t => {
//     const ws = new ReconnectingWebSocket(URL, null, {
//         maxRetries: 4,
//         reconnectionDelayGrowFactor: 1.2,
//         maxReconnectionDelay: 20,
//         minReconnectionDelay: 10,
//     });

//     const handleOpen = () => {};
//     const handleClose = () => {};
//     const handleMessage = () => {};
//     const handleError = () => {
//         expect(ws.onopen, handleOpen);
//         expect(ws.onclose, handleClose);
//         expect(ws.onmessage, handleMessage);
//         expect(ws.onerror, handleError);
//         if (ws.retryCount === 4) {
//             done();
//         }
//     };

//     ws.onopen = handleOpen;
//     ws.onclose = handleClose;
//     ws.onmessage = handleMessage;
//     ws.onerror = handleError;
// });

// test('level2 event listeners', t => {
//     const anyProtocol = 'foobar';
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, anyProtocol, {});

//     ws.addEventListener('open', () => {
//         expect(ws.protocol, anyProtocol);
//         expect(ws.extensions, '');
//         expect(ws.bufferedAmount, 0);
//         ws.close();
//     });

//     const fail = () => {
//         t.fail();
//     };
//     ws.addEventListener('unknown1', fail);
//     ws.addEventListener('open', fail);
//     ws.addEventListener('open', fail);
//     ws.removeEventListener('open', fail);
//     ws.removeEventListener('unknown2', fail);

//     ws.addEventListener('close', () => {
//         wss.close(() => {
//             setTimeout(() => done(), 500);
//         });
//     });
// });

// // https://developer.mozilla.org/en-US/docs/Web/API/EventListener/handleEvent
// test('level2 event listeners using object with handleEvent', t => {
//     const anyProtocol = 'foobar';
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, anyProtocol, {});

//     ws.addEventListener('open', {
//         handleEvent: () => {
//             expect(ws.protocol, anyProtocol);
//             expect(ws.extensions, '');
//             expect(ws.bufferedAmount, 0);
//             ws.close();
//         },
//     });

//     const fail = {
//         handleEvent: () => {
//             t.fail();
//         },
//     };
//     ws.addEventListener('unknown1', fail);
//     ws.addEventListener('open', fail);
//     ws.addEventListener('open', fail);
//     ws.removeEventListener('open', fail);
//     ws.removeEventListener('unknown2', fail);

//     ws.addEventListener('close', {
//         handleEvent: () => {
//             wss.close();
//             setTimeout(() => done(), 500);
//         },
//     });
// });

// test('connection timeout', t => {
//     const proc = spawn('node', [`${__dirname}/unresponsive-server.js`, PORT_UNRESPONSIVE, 5000]);
//     t.plan(2);

//     let lock = false;
//     proc.stdout.on('data', d => {
//         if (lock) return;
//         lock = true;

//         const ws = new ReconnectingWebSocket(`ws://localhost:${PORT_UNRESPONSIVE}`, null, {
//             minReconnectionDelay: 50,
//             connectionTimeout: 500,
//             maxRetries: 1,
//         });

//         ws.addEventListener('error', event => {
//             expect(event.message, 'TIMEOUT');
//             if (ws.retryCount === 1) {
//                 setTimeout(() => done(), 1000);
//             }
//         });
//     });
// });

// test('getters', t => {
//     const anyProtocol = 'foobar';
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, anyProtocol, {maxReconnectionDelay: 100});

//     ws.addEventListener('open', () => {
//         expect(ws.protocol, anyProtocol);
//         expect(ws.extensions, '');
//         expect(ws.bufferedAmount, 0);
//         expect(ws.binaryType, 'nodebuffer');
//         ws.close();
//     });

//     ws.addEventListener('close', () => {
//         wss.close();
//         setTimeout(() => done(), 500);
//     });
// });

// test('binaryType', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {minReconnectionDelay: 0});

//     expect(ws.binaryType, 'blob');
//     ws.binaryType = 'arraybuffer';
//     ws.addEventListener('open', () => {
//         expect(ws.binaryType, 'arraybuffer', 'assigned after open');
//         ws.binaryType = 'nodebuffer';
//         expect(ws.binaryType, 'nodebuffer');
//         ws.close();
//     });

//     ws.addEventListener('close', () => {
//         wss.close();
//         setTimeout(() => done(), 500);
//     });
// });

// test('calling to close multiple times', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {});

//     ws.addEventListener('open', () => {
//         ws.close();
//         ws.close();
//         ws.close();
//     });

//     ws.addEventListener('close', () => {
//         wss.close();
//         setTimeout(() => done(), 500);
//     });
// });

// test('calling to reconnect when not ready', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {});
//     ws.reconnect();
//     ws.reconnect();

//     ws.addEventListener('open', () => {
//         ws.close();
//     });

//     ws.addEventListener('close', () => {
//         wss.close();
//         setTimeout(() => done(), 500);
//     });
// });

// test('start closed', t => {
//     const anyMessageText = 'hello';
//     const anyProtocol = 'foobar';

//     const wss = new WebSocketServer({port: PORT});
//     wss.on('connection', ws => {
//         ws.on('message', msg => {
//             ws.send(msg);
//         });
//     });
//     wss.on('error', () => {
//         t.fail();
//     });

//     t.plan(8);

//     const ws = new ReconnectingWebSocket(URL, anyProtocol, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//         startClosed: true,
//     });

//     expect(ws.readyState, ws.CLOSED);

//     setTimeout(() => {
//         expect(ws.readyState, ws.CLOSED);

//         ws.reconnect();

//         ws.addEventListener('open', () => {
//             expect(ws.protocol, anyProtocol);
//             expect(ws.readyState, ws.OPEN);
//             ws.send(anyMessageText);
//         });

//         ws.addEventListener('message', msg => {
//             expect(msg.data, anyMessageText);
//             ws.close(1000, '');
//             expect(ws.readyState, ws.CLOSING);
//         });

//         ws.addEventListener('close', () => {
//             expect(ws.readyState, ws.CLOSED);
//             expect(ws.url, URL);
//             wss.close();
//             setTimeout(() => done(), 1000);
//         });
//     }, 300);
// });

// test('connect, send, receive, close', t => {
//     const anyMessageText = 'hello';
//     const anyProtocol = 'foobar';

//     const wss = new WebSocketServer({port: PORT});
//     wss.on('connection', ws => {
//         ws.on('message', msg => {
//             ws.send(msg);
//         });
//     });
//     wss.on('error', () => {
//         t.fail();
//     });

//     t.plan(7);

//     const ws = new ReconnectingWebSocket(URL, anyProtocol, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });
//     expect(ws.readyState, ws.CONNECTING);

//     ws.addEventListener('open', () => {
//         expect(ws.protocol, anyProtocol);
//         expect(ws.readyState, ws.OPEN);
//         ws.send(anyMessageText);
//     });

//     ws.addEventListener('message', msg => {
//         expect(msg.data, anyMessageText);
//         ws.close(1000, '');
//         expect(ws.readyState, ws.CLOSING);
//     });

//     ws.addEventListener('close', () => {
//         expect(ws.readyState, ws.CLOSED);
//         expect(ws.url, URL);
//         wss.close();
//         setTimeout(() => done(), 1000);
//     });
// });

// test('connect, send, receive, reconnect', t => {
//     const anyMessageText = 'hello';
//     const anyProtocol = 'foobar';

//     const wss = new WebSocketServer({port: PORT});
//     wss.on('connection', ws => {
//         ws.on('message', msg => {
//             ws.send(msg);
//         });
//     });

//     const totalRounds = 3;
//     let currentRound = 0;

//     // 6 = 3 * 2 open
//     // 8 = 2 * 3 message + 2 reconnect
//     // 7 = 2 * 3 close + 1 closed
//     t.plan(21);

//     const ws = new ReconnectingWebSocket(URL, anyProtocol, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     ws.onopen = () => {
//         currentRound++;
//         expect(ws.protocol, anyProtocol);
//         expect(ws.readyState, ws.OPEN);
//         ws.send(anyMessageText);
//     };

//     ws.onmessage = msg => {
//         expect(msg.data, anyMessageText);
//         if (currentRound < totalRounds) {
//             ws.reconnect(1000, 'reconnect');
//             expect(ws.retryCount, 0);
//         } else {
//             ws.close(1000, 'close');
//         }
//         expect(ws.readyState, ws.CLOSING);
//     };

//     ws.addEventListener('close', event => {
//         expect(ws.url, URL);
//         if (currentRound >= totalRounds) {
//             expect(ws.readyState, ws.CLOSED);
//             wss.close();
//             setTimeout(() => done(), 1000);
//             expect(event.reason, 'close');
//         } else {
//             expect(event.reason, 'reconnect');
//         }
//     });
// });

// test('immediately-failed connection should not timeout', t => {
//     const ws = new ReconnectingWebSocket('ws://255.255.255.255', null, {
//         maxRetries: 2,
//         connectionTimeout: 500,
//     });

//     ws.addEventListener('error', err => {
//         if (err.message === 'TIMEOUT') {
//             t.fail();
//         }
//         if (ws.retryCount === 2) {
//             setTimeout(() => done(), 500);
//         }
//         if (ws.retryCount > 2) {
//             t.fail();
//         }
//     });
// });

// test('immediately-failed connection with 0 maxRetries must not retry', t => {
//     const ws = new ReconnectingWebSocket('ws://255.255.255.255', [], {
//         maxRetries: 0,
//         connectionTimeout: 2000,
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     let i = 0;
//     ws.addEventListener('error', err => {
//         i++;
//         if (err.message === 'TIMEOUT') {
//             t.fail();
//         }
//         if (i > 1) {
//             t.fail();
//         }
//         setTimeout(() => {
//             done();
//         }, 2100);
//     });
// });

// test('connect and close before establishing connection', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     ws.close(); // closing before establishing connection

//     ws.addEventListener('open', () => {
//         t.fail('open never called');
//     });

//     let closeCount = 0;
//     ws.addEventListener('close', () => {
//         closeCount++;
//         if (closeCount > 1) {
//             t.fail('close should be called once');
//         }
//     });

//     setTimeout(() => {
//         // wait a little to be sure no unexpected open or close events happen
//         wss.close();
//         done();
//     }, 1000);
// });

// test('enqueue messages', t => {
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         maxRetries: 0,
//     });
//     const count = 10;
//     const message = 'message';
//     for (let i = 0; i < count; i++) ws.send(message);

//     ws.onerror = () => {
//         expect(ws.bufferedAmount, message.length * count);
//         t.pass();
//         done();
//     };
// });

// test('respect maximum enqueued messages', t => {
//     const queueSize = 2;
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         maxRetries: 0,
//         maxEnqueuedMessages: queueSize,
//     });
//     const count = 10;
//     const message = 'message';
//     for (let i = 0; i < count; i++) ws.send(message);

//     ws.onerror = () => {
//         expect(ws.bufferedAmount, message.length * queueSize);
//         t.pass();
//         done();
//     };
// });

// test('enqueue messages before websocket initialization with expected order', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL);

//     const messages = ['message1', 'message2', 'message3'];

//     messages.forEach(m => ws.send(m));
//     expect(ws._messageQueue.length, messages.length);

//     expect(ws.bufferedAmount, messages.reduce((a, m) => a + m.length, 0));

//     let i = 0;
//     wss.on('connection', client => {
//         client.on('message', data => {
//             if (data === 'ok') {
//                 expect(i, messages.length, 'enqueued messages are sent first');
//                 ws.close();
//             } else {
//                 expect(data, messages[i]);
//                 i++;
//             }
//         });
//     });

//     ws.addEventListener('open', () => {
//         ws.send('ok');
//     });

//     ws.addEventListener('close', () => {
//         wss.close(() => {
//             done();
//         });
//     });
// });

// test('closing from the other side should reconnect', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     let max = 3;
//     let i = 0;
//     wss.on('connection', client => {
//         i++;
//         if (i < max) {
//             t.pass('closing client from server side should trigger a reconnection');
//             setTimeout(() => client.close(), 100);
//         }
//         if (i === max) {
//             // will close from client side
//         }
//         if (i > max) {
//             t.fail('unexpected connection');
//         }
//     });

//     let j = 0;
//     ws.addEventListener('open', () => {
//         j++;
//         if (j === max) {
//             ws.close();
//             // wait a little to ensure no new connections are opened
//             setTimeout(() => {
//                 wss.close(() => {
//                     done();
//                 });
//             }, 500);
//         }
//         if (j > max) {
//             t.fail('unexpected open');
//         }
//     });
// });

// test('closing from the other side should allow to keep closed', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     const codes = [4000, 4001];

//     let i = 0;
//     wss.on('connection', client => {
//         if (i > codes.length) {
//             t.fail();
//         }
//         client.close(codes[i], String(codes[i]));
//         i++;
//     });

//     let j = 0;
//     ws.addEventListener('close', e => {
//         if (e.code === codes[0]) {
//             // do nothing, will reconnect
//         }
//         if (e.code === codes[1] && e.reason === String(codes[1])) {
//             // close connection (and keep closed)
//             ws.close();
//             setTimeout(() => {
//                 wss.close(() => done());
//             }, 1000);
//         }
//     });
// });

// test('reconnection delay grow factor', t => {
//     const ws = new ReconnectingWebSocket('wss://255.255.255.255', [], {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 1000,
//         reconnectionDelayGrowFactor: 2,
//     });
//     expect(ws._getNextDelay(), 0);
//     const expected = [100, 200, 400, 800, 1000, 1000];
//     let retry = 0;
//     ws.addEventListener('error', e => {
//         expect(ws._getNextDelay(), expected[retry]);
//         retry++;
//         if (retry >= expected.length) {
//             ws.close();
//             setTimeout(() => {
//                 done();
//             }, 2000);
//         }
//     });
// });

// test('minUptime', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, [], {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 2000,
//         reconnectionDelayGrowFactor: 2,
//         minUptime: 500,
//     });
//     const expectedDelays = [100, 200, 400, 800, 100, 100];
//     const expectedRetryCount = [1, 2, 3, 4, 1, 1];
//     let connectionCount = 0;
//     wss.on('connection', client => {
//         connectionCount++;
//         if (connectionCount <= expectedDelays.length) {
//             setTimeout(() => {
//                 client.close();
//             }, connectionCount * 100);
//         }
//     });
//     let openCount = 0;
//     ws.addEventListener('open', e => {
//         openCount++;
//         if (openCount > expectedDelays.length) {
//             ws.close();
//             wss.close(() => {
//                 setTimeout(() => {
//                     done();
//                 }, 1000);
//             });
//         }
//     });
//     let closeCount = 0;
//     ws.addEventListener('close', () => {
//         if (closeCount < expectedDelays.length) {
//             expect(ws._getNextDelay(), expectedDelays[closeCount]);
//             expect(ws._retryCount, expectedRetryCount[closeCount]);
//             closeCount++;
//         }
//     });
// });

// test('reconnect after closing', t => {
//     const wss = new WebSocketServer({port: PORT});
//     const ws = new ReconnectingWebSocket(URL, undefined, {
//         minReconnectionDelay: 100,
//         maxReconnectionDelay: 200,
//     });

//     let i = 0;
//     ws.addEventListener('open', () => {
//         i++;
//         if (i === 1) {
//             ws.close();
//         }
//         if (i === 2) {
//             ws.close();
//         }
//         if (i > 2) {
//             t.fail('no more reconnections expected');
//         }
//     });

//     ws.addEventListener('close', () => {
//         if (i === 1)
//             setTimeout(() => {
//                 ws.reconnect();
//             }, 1000);
//         if (i === 2) {
//             wss.close(() => {
//                 setTimeout(() => {
//                     done();
//                 }, 1000);
//             });
//         }
//         if (i > 2) {
//             t.fail('no more reconnections expected');
//         }
//     });
// });

// // test('reconnect after closing', t => {
// //     const wss = new WebSocketServer({port: PORT});
// //     const ws = new ReconnectingWebSocket(URL, undefined, {
// //         minReconnectionDelay: 100,
// //         maxReconnectionDelay: 200,
// //     });

// //     ws.addEventListener('open', () => {});

// //     ws.addEventListener('close', () => {});
// // });
