const DEFAULT_OPTIONS = {
    constructor: (typeof WebSocket === 'function') ? WebSocket : null,
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1500,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: true, // @todo change to false
};

const bypassProperty = (src, dst, name: string) => {
    Object.defineProperty(dst, name, {
        get: () => src[name],
        set: (value) => { src[name] = value },
        enumerable: true,
    });
};

const initReconnectionDelay = (config) =>
    (config.minReconnectionDelay + Math.random() * config.minReconnectionDelay);

const updateReconnectionDelay = (config, previousDelay) => {
    let newDelay = previousDelay * config.reconnectionDelayGrowFactor;
    return (newDelay > config.maxReconnectionDelay)
        ? config.maxReconnectionDelay
        : newDelay;
}

const WEBSOCKET_BYPASSED_PROPERTIES = [
    'CONNECTING',
    'OPEN',
    'CLOSING',
    'CLOSED',
    'url',
    'readyState',
    'bufferedAmount',
    'extensions',
    'protocol',
    'binaryType',
    'close',
    'send',
    'dispatchEvent',
    'onmessage',
    'onopen',
    'onerror',
    'onclose',
];

const ReconnectingWebsocket = function(
    url: string,
    protocols?: string|string[],
    options: Object = {}
) {
    let ws;
    let connectingTimeout;
    let reconnectDelay = 0;
    let retriesCount = 0;
    const eventListeners = {};

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

    const log = config.debug ? (...text) => console.log('RWS:', ...text) : () => {};

    const connect = () => {
        log('connect');

        ws = new (<any>config.constructor)(url, protocols);

        ws.addEventListener('open', (evt) => {
            log('open');
            reconnectDelay = initReconnectionDelay(config);
            clearTimeout(connectingTimeout);
            retriesCount = 0;
        });

        ws.addEventListener('close', (evt) => {
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
            connectingTimeout = setTimeout(connect, reconnectDelay);
        });
    };

    log('init');
    connect();

    WEBSOCKET_BYPASSED_PROPERTIES.forEach(name => bypassProperty(ws, this, name));

    this.addEventListener = (type: string, listener: Function, options: any) => {
        if (Array.isArray(this.eventListeners[type])) {
            if (!this.eventListeners[type].some(({l}) => l === listener)) {
                this.eventListeners[type].push({listener, options});
            }
        } else {
            this.eventListeners[type] = [{listener, options}];
        }
        ws.addEventListener(type, listener, options);
    };

    this.removeEventListener = (type: string, listener: Function, options: any) => {
        if (Array.isArray(this.eventListeners[type])) {
            this.eventListeners[type] = this.eventListeners[type].filter(({l}) => l !== listener);
        }
        ws.removeEventListener(type, listener, options);
    };
};

export = ReconnectingWebsocket;
