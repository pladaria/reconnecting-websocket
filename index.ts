/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
type Options = {
    [key: string]: any,
    constructor?: new(url: string, protocols?: string | string[]) => WebSocket;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    debug?: boolean;
};

interface EventListener {
    (event?: any): any;
};

interface EventListeners {
    [key: string]: [EventListener, any][];
};

interface ReconnectingWebsocket extends WebSocket {
    [key: string]: any;
};

const isWebSocket = (constructor: any): boolean => constructor && constructor.CLOSING === 2;

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

const bypassProperty = (src: any, dst: any, name: string) => {
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

const reassignEventListeners = (ws: WebSocket, rws: ReconnectingWebsocket, listeners: EventListeners) => {
    Object.keys(listeners).forEach(type => {
        listeners[type].forEach(([listener, options]) => {
            ws.addEventListener(type, listener, options);
        });
    });
    ws.onopen = rws.onopen.bind(rws)
    ws.onerror = rws.onerror.bind(rws)
    ws.onmessage = rws.onmessage.bind(rws)
    ws.onclose = rws.onclose.bind(rws)
};

const ReconnectingWebsocket = function(
    url: string | (() => Promise<string>),
    protocols?: string | string[],
    options = <Options>{}
) {
    let ws: WebSocket;
    let connectingTimeout: number;
    let reconnectDelay = 0;
    let retriesCount = 0;
    let shouldRetry = true;
    let savedOnClose: any = null;
    const listeners: EventListeners = {};

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

    const log = config.debug ? (...params: any[]) => console.log('RWS:', ...params) : () => {};

    const ctor = config.constructor as any
    this.CONNECTING = ctor.CONNECTING;
    this.OPEN = ctor.OPEN;
    this.CLOSING = ctor.CLOSING;
    this.CLOSED = ctor.CLOSED;

    // Temporarily set these until we have an underlying ws instance.
    this.readyState = this.CONNECTING;
    this.protocol = protocols;

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
        log('handleClose', {shouldRetry});
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
        log('handleClose - reconnectDelay:', reconnectDelay);

        if (shouldRetry) {
            setTimeout(connect, reconnectDelay);
        }
    };

    const connect = (): Promise<WebSocket> => {
        if (!shouldRetry) {
            return;
        }

        log('connect');

        const urlPromise = (typeof url === 'string') ? Promise.resolve(url) : url()
        return urlPromise.then((connectionUrl: string) => {
            ws = new (<any>config.constructor)(connectionUrl, protocols);

            connectingTimeout = setTimeout(() => {
                log('timeout');
                ws.close();
                emitError('ETIMEDOUT', 'Connection timeout');
            }, config.connectionTimeout);

            log('bypass properties');

            // @todo move to constant
            const bypassedProperties = ['url', 'protocol', 'readyState', 'bufferedAmount'];
            for (const key of bypassedProperties) {
                bypassProperty(ws, this, key);
            }

            ws.addEventListener('open', () => {
                clearTimeout(connectingTimeout);
                log('open');
                reconnectDelay = initReconnectionDelay(config);
                log('reconnectDelay:', reconnectDelay);
                retriesCount = 0;
            });

            ws.addEventListener('close', handleClose);
        
            reassignEventListeners(ws, this, listeners);
           
            // because when closing with fastClose=true, it is saved and set to null to avoid double calls
            ws.onclose = ws.onclose || savedOnClose;
            savedOnClose = null;

            return ws;
        });
    };
    // ready is a promise that is resolved when the underlying websocket is initialized
    this.ready = connect().then(() => this);

    log('init');

    this.close = (code = 1000, reason = '', {keepClosed = false, fastClose = true, delay = 0} = {}) => {
        log('close - params:', {reason, keepClosed, fastClose, delay, retriesCount, maxRetries: config.maxRetries});
        shouldRetry = !keepClosed && retriesCount <= config.maxRetries;

        if (delay) {
            reconnectDelay = delay;
        }

        if (ws) ws.close(code, reason);

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

            if (ws) {
                ws.removeEventListener('close', handleClose);

                // run and remove level2
                if (Array.isArray(listeners.close)) {
                    listeners.close.forEach(([listener, options]) => {
                        listener(fakeCloseEvent);
                        ws.removeEventListener('close', listener, options);
                    });
                }

                // run and remove level0
                if (ws.onclose) {
                    savedOnClose = ws.onclose;
                    ws.onclose(fakeCloseEvent);
                    ws.onclose = null;
                }
            }
        }
    };

    this.send = (data: any) => {
        ws.send(data)
    };

    // Define Level 0 event stubs
    const level0Listeners: any = {
        onopen: () => {},
        onmessage: () => {},
        onclose: () => {},
        onerror: () => {},
    };

    ['onopen', 'onerror', 'onmessage', 'onclose'].forEach((type: string) => {
        Object.defineProperty(this, type, {
            get: () => level0Listeners[type],
            set: (v) => {
                // Set it on this and also set it on the underlying ws if there is one.
                level0Listeners[type] = v;
                if (ws) (ws as any)[type] = v;
            }
        })
    });

    this.addEventListener = (type: string, listener: EventListener, options: any) => {
        if (Array.isArray(listeners[type])) {
            if (!listeners[type].some(([l]) => l === listener)) {
                listeners[type].push([listener, options]);
            }
        } else {
            listeners[type] = [[listener, options]];
        }
        if (ws) ws.addEventListener(type, listener, options);
    };

    this.removeEventListener = (type: string, listener: EventListener, options: any) => {
        if (Array.isArray(listeners[type])) {
            listeners[type] = listeners[type].filter(([l]) => l !== listener);
        }
        if (ws) ws.removeEventListener(type, listener, options);
    };

};

export = ReconnectingWebsocket;
