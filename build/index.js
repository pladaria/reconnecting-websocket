"use strict";
var DEFAULT_OPTIONS = {
    constructor: (typeof WebSocket === 'function') ? WebSocket : null,
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1500,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: true,
};
var bypassProperty = function (src, dst, name) {
    Object.defineProperty(dst, name, {
        get: function () { return src[name]; },
        set: function (value) { src[name] = value; },
        enumerable: true,
    });
};
var initReconnectionDelay = function (config) {
    return (config.minReconnectionDelay + Math.random() * config.minReconnectionDelay);
};
var updateReconnectionDelay = function (config, previousDelay) {
    var newDelay = previousDelay * config.reconnectionDelayGrowFactor;
    return (newDelay > config.maxReconnectionDelay)
        ? config.maxReconnectionDelay
        : newDelay;
};
var WEBSOCKET_BYPASSED_PROPERTIES = [
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
var ReconnectingWebsocket = function (url, protocols, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    var ws;
    var connectingTimeout;
    var reconnectDelay = 0;
    var retriesCount = 0;
    var eventListeners = {};
    // require new to construct
    if (!(this instanceof ReconnectingWebsocket)) {
        throw new TypeError("Failed to construct 'ReconnectingWebSocket': Please use the 'new' operator");
    }
    // Set config. Not using `Object.assign` because of IE11
    var config = DEFAULT_OPTIONS;
    Object.keys(config)
        .filter(function (key) { return options.hasOwnProperty(key); })
        .forEach(function (key) { return config[key] = options[key]; });
    if (typeof config.constructor !== 'function') {
        throw new TypeError('WebSocket constructor not set. Set `options.constructor`');
    }
    var log = config.debug ? function () {
        var text = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            text[_i - 0] = arguments[_i];
        }
        return console.log.apply(console, ['RWS:'].concat(text));
    } : function () { };
    var connect = function () {
        log('connect');
        ws = new config.constructor(url, protocols);
        ws.addEventListener('open', function (evt) {
            log('open');
            reconnectDelay = initReconnectionDelay(config);
            clearTimeout(connectingTimeout);
            retriesCount = 0;
        });
        ws.addEventListener('close', function (evt) {
            log('close');
            retriesCount++;
            if (retriesCount > config.maxRetries) {
                throw new Error('Too many failed connection attempts');
            }
            if (!reconnectDelay) {
                reconnectDelay = initReconnectionDelay(config);
            }
            else {
                reconnectDelay = updateReconnectionDelay(config, reconnectDelay);
            }
            connectingTimeout = setTimeout(connect, reconnectDelay);
        });
    };
    log('init');
    connect();
    WEBSOCKET_BYPASSED_PROPERTIES.forEach(function (name) { return bypassProperty(ws, _this, name); });
    this.addEventListener = function (type, listener, options) {
        if (Array.isArray(this.eventListeners[type])) {
            if (!this.eventListeners[type].some(function (_a) {
                var l = _a.l;
                return l === listener;
            })) {
                this.eventListeners[type].push({ listener: listener, options: options });
            }
        }
        else {
            this.eventListeners[type] = [{ listener: listener, options: options }];
        }
        ws.addEventListener(type, listener, options);
    };
    this.removeEventListener = function (type, listener, options) {
        if (Array.isArray(this.eventListeners[type])) {
            this.eventListeners[type] = this.eventListeners[type].filter(function (_a) {
                var l = _a.l;
                return l !== listener;
            });
        }
        ws.removeEventListener(type, listener, options);
    };
};
module.exports = ReconnectingWebsocket;
