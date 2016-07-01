const DEFAULT_OPTIONS = {
    constructor: (typeof WebSocket === 'function') ? WebSocket : null,
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1500,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: false,
};

const bypassProperty = (src, dst, name: string) => {
    Object.defineProperty(dst, name, {
        get: () => src[name],
        set: (value) => {src[name] = value},
        enumerable: true,
        configurable: true,
    });
};

const initReconnectionDelay = (config) =>
    (config.minReconnectionDelay + Math.random() * config.minReconnectionDelay);

const updateReconnectionDelay = (config, previousDelay) => {
    let newDelay = previousDelay * config.reconnectionDelayGrowFactor;
    return (newDelay > config.maxReconnectionDelay)
        ? config.maxReconnectionDelay
        : newDelay;
};

const reassignEventListeners = (ws, listeners) => {
    Object.keys(listeners).forEach(type => {
        listeners[type].forEach(([listener, options]) => {
            ws.addEventListener(type, listener, options);
        });
    });
};

const ReconnectingWebsocket = function(
    url: string,
    protocols?: string|string[],
    options: Object = {}
) {
    let ws;
    let connectingTimeout;
    let reconnectDelay = 0;
    let retriesCount = 0;
    let shouldRetry = true;
    const listeners = {};

    // require new to construct
    if (!(this instanceof ReconnectingWebsocket)) {
        throw new TypeError("Failed to construct 'ReconnectingWebSocket': Please use the 'new' operator");
    }

    // Set config. Not using `Object.assign` because of IE11
    const config = DEFAULT_OPTIONS;
    Object.keys(config)
        .filter(key => options.hasOwnProperty(key))
        .forEach(key => config[key] = options[key]);

    if (typeof config.constructor !== 'function') {
        throw new TypeError('WebSocket constructor not set. Set `options.constructor`');
    }

    const log = config.debug ? (...params) => console.log('RWS:', ...params) : () => {};

    const connect = () => {
        log('connect');

        ws = new (<any>config.constructor)(url, protocols);

        log('bypass properties');
        for (let key in ws) {
            // @todo move to constant
            if (['addEventListener', 'removeEventListener', 'close'].indexOf(key) < 0) {
                bypassProperty(ws, this, key);
            }
        }

        ws.addEventListener('open', () => {
            log('open');
            reconnectDelay = initReconnectionDelay(config);
            log('reconnectDelay:', reconnectDelay);
            // clearTimeout(connectingTimeout);
            retriesCount = 0;
        });

        ws.addEventListener('close', () => {
            log('close');
            retriesCount++;
            if (retriesCount > config.maxRetries) {
                throw new Error('Too many failed connection attempts')
            }
            if (!reconnectDelay) {
                reconnectDelay = initReconnectionDelay(config)
            } else {
                reconnectDelay = updateReconnectionDelay(config, reconnectDelay)
            }
            log('reconnectDelay:', reconnectDelay);

            if (shouldRetry) {
                setTimeout(connect, reconnectDelay);
            }
        });

        reassignEventListeners(ws, listeners);
    };

    log('init');
    connect();

    this.close = () => {
        shouldRetry = false;
        ws.close();
    };

    this.addEventListener = (type: string, listener: Function, options: any) => {
        if (Array.isArray(listeners[type])) {
            if (!listeners[type].some(([l]) => l === listener)) {
                listeners[type].push([listener, options]);
            }
        } else {
            listeners[type] = [[listener, options]];
        }
        ws.addEventListener(type, listener, options);
    };

    this.removeEventListener = (type: string, listener: Function, options: any) => {
        if (Array.isArray(listeners[type])) {
            listeners[type] = listeners[type].filter(([l]) => l !== listener);
        }
        ws.removeEventListener(type, listener, options);
    };
};

export = ReconnectingWebsocket;
