type Options = {
    constructor?: new(url: string, protocols?: string | string[]) => WebSocket;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    debug?: boolean;
};

const isWebSocket = constructor =>
    constructor && constructor.CLOSING === 2;

const isGlobalWebSocket = () =>
    typeof WebSocket !== 'undefined' && isWebSocket(WebSocket);

const getDefaultOptions = () => <Options>({
    constructor: isGlobalWebSocket() ? WebSocket : null,
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1500,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: false,
});

const bypassProperty = (src, dst, name: string) => {
    Object.defineProperty(dst, name, {
        get: () => src[name],
        set: (value) => {src[name] = value},
        enumerable: true,
        configurable: true,
    });
};

const initReconnectionDelay = (config: Options) =>
    (config.minReconnectionDelay + Math.random() * config.minReconnectionDelay);

const updateReconnectionDelay = (config: Options, previousDelay: number) => {
    const newDelay = previousDelay * config.reconnectionDelayGrowFactor;
    return (newDelay > config.maxReconnectionDelay)
        ? config.maxReconnectionDelay
        : newDelay;
};

const LEVEL_0_EVENTS = ['onopen', 'onclose', 'onmessage', 'onerror'];

const reassignEventListeners = (ws: WebSocket, oldWs: WebSocket, listeners) => {
    Object.keys(listeners).forEach(type => {
        listeners[type].forEach(([listener, options]) => {
            ws.addEventListener(type, listener, options);
        });
    });
    if (oldWs) {
        LEVEL_0_EVENTS.forEach(name => {ws[name] = oldWs[name]});
    }
};

const ReconnectingWebsocket = function(
    url: string,
    protocols?: string|string[],
    options = <Options>{}
) {
    let ws: WebSocket;
    let connectingTimeout;
    let reconnectDelay = 0;
    let retriesCount = 0;
    let shouldRetry = true;
    let savedOnClose = null;
    const listeners: any = {};

    // require new to construct
    if (!(this instanceof ReconnectingWebsocket)) {
        throw new TypeError("Failed to construct 'ReconnectingWebSocket': Please use the 'new' operator");
    }

    // Set config. Not using `Object.assign` because of IE11
    const config = getDefaultOptions();
    Object.keys(config)
        .filter(key => options.hasOwnProperty(key))
        .forEach(key => config[key] = options[key]);

    if (!isWebSocket(config.constructor)) {
        throw new TypeError('Invalid WebSocket constructor. Set `options.constructor`');
    }

    const log = config.debug ? (...params) => console.log('RWS:', ...params) : () => {};

    /**
     * Not using dispatchEvent, otherwise we must use a DOM Event object
     * Deferred because we want to handle the close event before this
     */
    const emitError = (code: string, msg: string) => setTimeout(() => {
        const err = <any>new Error(msg);
        err.code = code;
        if (Array.isArray(listeners.error)) {
            listeners.error.forEach(([fn]) => fn(err));
        }
        if (ws.onerror) {
            ws.onerror(err);
        }
    }, 0);

    const handleClose = () => {
        log('close');
        retriesCount++;
        log('retries count:', retriesCount);
        if (retriesCount > config.maxRetries) {
            emitError('EHOSTDOWN', 'Too many failed connection attempts');
            return;
        }
        if (!reconnectDelay) {
            reconnectDelay = initReconnectionDelay(config);
        } else {
            reconnectDelay = updateReconnectionDelay(config, reconnectDelay);
        }
        log('reconnectDelay:', reconnectDelay);

        if (shouldRetry) {
            setTimeout(connect, reconnectDelay);
        }
    };

    const connect = () => {
        log('connect');
        const oldWs = ws;
        ws = new (<any>config.constructor)(url, protocols);

        connectingTimeout = setTimeout(() => {
            log('timeout');
            ws.close();
            emitError('ETIMEDOUT', 'Connection timeout');
        }, config.connectionTimeout);

        log('bypass properties');
        for (let key in ws) {
            // @todo move to constant
            if (['addEventListener', 'removeEventListener', 'close', 'send'].indexOf(key) < 0) {
                bypassProperty(ws, this, key);
            }
        }

        ws.addEventListener('open', () => {
            clearTimeout(connectingTimeout);
            log('open');
            reconnectDelay = initReconnectionDelay(config);
            log('reconnectDelay:', reconnectDelay);
            retriesCount = 0;
        });

        ws.addEventListener('close', handleClose);

        reassignEventListeners(ws, oldWs, listeners);

        // because when closing with fastClose=true, it is saved and set to null to avoid double calls
        ws.onclose = ws.onclose || savedOnClose;
        savedOnClose = null;
    };

    log('init');
    connect();

    this.close = (code = 1000, reason = '', {keepClosed = false, fastClose = true, delay = 0} = {}) => {
        if (delay) {
            reconnectDelay = delay;
        }
        shouldRetry = !keepClosed;

        ws.close(code, reason);

        if (fastClose) {
            const fakeCloseEvent = <CloseEvent>{
                code,
                reason,
                wasClean: true,
            };

            // execute close listeners soon with a fake closeEvent
            // and remove them from the WS instance so they
            // don't get fired on the real close.
            handleClose();
            ws.removeEventListener('close', handleClose);
            // run and remove level2
            if (Array.isArray(listeners.close)) {
                listeners.close.forEach(([listener, options]) => {
                    listener(fakeCloseEvent);
                    ws.removeEventListener('close', listener, options);
                });
            }
            // remove level0
            if (ws.onclose) {
                savedOnClose = ws.onclose;
                ws.onclose(fakeCloseEvent);
                ws.onclose = null;
            }
        }
    };

    this.send = (data) => {
        ws.send(data)
    };

    this.addEventListener = (type: string, listener: EventListener, options: any) => {
        if (Array.isArray(listeners[type])) {
            if (!listeners[type].some(([l]) => l === listener)) {
                listeners[type].push([listener, options]);
            }
        } else {
            listeners[type] = [[listener, options]];
        }
        ws.addEventListener(type, listener, options);
    };

    this.removeEventListener = (type: string, listener: EventListener, options: any) => {
        if (Array.isArray(listeners[type])) {
            listeners[type] = listeners[type].filter(([l]) => l !== listener);
        }
        ws.removeEventListener(type, listener, options);
    };
};

export = ReconnectingWebsocket;
