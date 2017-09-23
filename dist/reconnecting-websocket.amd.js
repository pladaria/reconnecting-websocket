define("index", ["require", "exports"], function (require, exports) {
    "use strict";
    ;
    ;
    ;
    var isWebSocket = function (constructor) {
        return constructor && constructor.CLOSING === 2;
    };
    var isGlobalWebSocket = function () {
        return typeof WebSocket !== 'undefined' && isWebSocket(WebSocket);
    };
    var getDefaultOptions = function () { return ({
        constructor: isGlobalWebSocket() ? WebSocket : null,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1500,
        reconnectionDelayGrowFactor: 1.3,
        connectionTimeout: 4000,
        maxRetries: Infinity,
        debug: false,
    }); };
    var bypassProperty = function (src, dst, name) {
        Object.defineProperty(dst, name, {
            get: function () { return src[name]; },
            set: function (value) { src[name] = value; },
            enumerable: true,
            configurable: true,
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
    var LEVEL_0_EVENTS = ['onopen', 'onclose', 'onmessage', 'onerror'];
    var reassignEventListeners = function (ws, oldWs, listeners) {
        Object.keys(listeners).forEach(function (type) {
            listeners[type].forEach(function (_a) {
                var listener = _a[0], options = _a[1];
                ws.addEventListener(type, listener, options);
            });
        });
        if (oldWs) {
            LEVEL_0_EVENTS.forEach(function (name) {
                ws[name] = oldWs[name];
            });
        }
    };
    var ReconnectingWebsocket = function (url, protocols, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var ws;
        var connectingTimeout;
        var reconnectDelay = 0;
        var retriesCount = 0;
        var shouldRetry = true;
        var savedOnClose = null;
        var listeners = {};
        // require new to construct
        if (!(this instanceof ReconnectingWebsocket)) {
            throw new TypeError("Failed to construct 'ReconnectingWebSocket': Please use the 'new' operator");
        }
        // Set config. Not using `Object.assign` because of IE11
        var config = getDefaultOptions();
        Object.keys(config)
            .filter(function (key) { return options.hasOwnProperty(key); })
            .forEach(function (key) { return config[key] = options[key]; });
        if (!isWebSocket(config.constructor)) {
            throw new TypeError('Invalid WebSocket constructor. Set `options.constructor`');
        }
        var log = config.debug ? function () {
            var params = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                params[_i] = arguments[_i];
            }
            return console.log.apply(console, ['RWS:'].concat(params));
        } : function () { };
        /**
         * Not using dispatchEvent, otherwise we must use a DOM Event object
         * Deferred because we want to handle the close event before this
         */
        var emitError = function (code, msg) { return setTimeout(function () {
            var err = new Error(msg);
            err.code = code;
            if (Array.isArray(listeners.error)) {
                listeners.error.forEach(function (_a) {
                    var fn = _a[0];
                    return fn(err);
                });
            }
            if (ws.onerror) {
                ws.onerror(err);
            }
        }, 0); };
        var handleClose = function () {
            log('handleClose', { shouldRetry: shouldRetry });
            retriesCount++;
            log('retries count:', retriesCount);
            if (retriesCount > config.maxRetries) {
                emitError('EHOSTDOWN', 'Too many failed connection attempts');
                return;
            }
            if (!reconnectDelay) {
                reconnectDelay = initReconnectionDelay(config);
            }
            else {
                reconnectDelay = updateReconnectionDelay(config, reconnectDelay);
            }
            log('handleClose - reconnectDelay:', reconnectDelay);
            if (shouldRetry) {
                setTimeout(connect, reconnectDelay);
            }
        };
        var connect = function () {
            if (!shouldRetry) {
                return;
            }
            log('connect');
            var oldWs = ws;
            var wsUrl = (typeof url === 'function') ? url() : url;
            ws = new config.constructor(wsUrl, protocols);
            connectingTimeout = setTimeout(function () {
                log('timeout');
                ws.close();
                emitError('ETIMEDOUT', 'Connection timeout');
            }, config.connectionTimeout);
            log('bypass properties');
            for (var key in ws) {
                // @todo move to constant
                if (['addEventListener', 'removeEventListener', 'close', 'send'].indexOf(key) < 0) {
                    bypassProperty(ws, _this, key);
                }
            }
            ws.addEventListener('open', function () {
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
        this.close = function (code, reason, _a) {
            if (code === void 0) { code = 1000; }
            if (reason === void 0) { reason = ''; }
            var _b = _a === void 0 ? {} : _a, _c = _b.keepClosed, keepClosed = _c === void 0 ? false : _c, _d = _b.fastClose, fastClose = _d === void 0 ? true : _d, _e = _b.delay, delay = _e === void 0 ? 0 : _e;
            log('close - params:', { reason: reason, keepClosed: keepClosed, fastClose: fastClose, delay: delay, retriesCount: retriesCount, maxRetries: config.maxRetries });
            shouldRetry = !keepClosed && retriesCount <= config.maxRetries;
            if (delay) {
                reconnectDelay = delay;
            }
            ws.close(code, reason);
            if (fastClose) {
                var fakeCloseEvent_1 = {
                    code: code,
                    reason: reason,
                    wasClean: true,
                };
                // execute close listeners soon with a fake closeEvent
                // and remove them from the WS instance so they
                // don't get fired on the real close.
                handleClose();
                ws.removeEventListener('close', handleClose);
                // run and remove level2
                if (Array.isArray(listeners.close)) {
                    listeners.close.forEach(function (_a) {
                        var listener = _a[0], options = _a[1];
                        listener(fakeCloseEvent_1);
                        ws.removeEventListener('close', listener, options);
                    });
                }
                // run and remove level0
                if (ws.onclose) {
                    savedOnClose = ws.onclose;
                    ws.onclose(fakeCloseEvent_1);
                    ws.onclose = null;
                }
            }
        };
        this.send = function (data) {
            ws.send(data);
        };
        this.addEventListener = function (type, listener, options) {
            if (Array.isArray(listeners[type])) {
                if (!listeners[type].some(function (_a) {
                    var l = _a[0];
                    return l === listener;
                })) {
                    listeners[type].push([listener, options]);
                }
            }
            else {
                listeners[type] = [[listener, options]];
            }
            ws.addEventListener(type, listener, options);
        };
        this.removeEventListener = function (type, listener, options) {
            if (Array.isArray(listeners[type])) {
                listeners[type] = listeners[type].filter(function (_a) {
                    var l = _a[0];
                    return l !== listener;
                });
            }
            ws.removeEventListener(type, listener, options);
        };
    };
    return ReconnectingWebsocket;
});
