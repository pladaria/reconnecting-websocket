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
var reassignEventListeners = function (ws, eventListeners) {
    Object.keys(eventListeners).forEach(function (type) {
        eventListeners[type].forEach(function (_a) {
            var listener = _a[0], options = _a[1];
            ws.addEventListener(type, listener, options);
        });
    });
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
        console.log(config);
        console.log(config.constructor, typeof config.constructor);
        throw new TypeError('WebSocket constructor not set. Set `options.constructor`');
    }
    var log = config.debug ? function () {
        var params = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            params[_i - 0] = arguments[_i];
        }
        return console.log.apply(console, ['RWS:'].concat(params));
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
        reassignEventListeners(ws, eventListeners);
    };
    log('init');
    connect();
    WEBSOCKET_BYPASSED_PROPERTIES.forEach(function (name) { return bypassProperty(ws, _this, name); });
    this.addEventListener = function (type, listener, options) {
        if (Array.isArray(eventListeners[type])) {
            if (!eventListeners[type].some(function (_a) {
                var l = _a[0];
                return l === listener;
            })) {
                eventListeners[type].push([listener, options]);
            }
        }
        else {
            eventListeners[type] = [[listener, options]];
        }
        ws.addEventListener(type, listener, options);
    };
    this.removeEventListener = function (type, listener, options) {
        if (Array.isArray(eventListeners[type])) {
            eventListeners[type] = eventListeners[type].filter(function (_a) {
                var l = _a[0];
                return l !== listener;
            });
        }
        ws.removeEventListener(type, listener, options);
    };
};
module.exports = ReconnectingWebsocket;
