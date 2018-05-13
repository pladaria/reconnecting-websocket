'use strict';

class Event {
    constructor(type, target) {
        this.target = target;
        this.type = type;
    }
}
class ErrorEvent extends Event {
    constructor(error, target) {
        super('error', target);
        this.message = error.message;
        this.error = error;
    }
}
class CloseEvent extends Event {
    constructor(code = 1000, reason = '', target) {
        super('close', target);
        this.wasClean = true;
        this.code = code;
        this.reason = reason;
    }
}

/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
const getGlobalWebSocket = () => {
    if (typeof WebSocket !== 'undefined') {
        // @ts-ignore
        return WebSocket;
    }
};
/**
 * Returns true if given argument looks like a WebSocket class
 */
const isWebSocket = (w) => typeof w === 'function' && w.CLOSING === 2;
const DEFAULT = {
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1000 + Math.random() * 4000,
    minUptime: 5000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: false,
};
class ReconnectingWebSocket {
    constructor(url, protocols, options = {}) {
        this._listeners = {};
        this._retryCount = -1;
        this._shouldReconnect = true;
        this._connectLock = false;
        this.eventToHandler = new Map([
            ['open', this._handleOpen.bind(this)],
            ['close', this._handleClose.bind(this)],
            ['error', this._handleError.bind(this)],
            ['message', this._handleMessage.bind(this)],
        ]);
        /**
         * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
         */
        this.onclose = undefined;
        /**
         * An event listener to be called when an error occurs
         */
        this.onerror = undefined;
        /**
         * An event listener to be called when a message is received from the server
         */
        this.onmessage = undefined;
        /**
         * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
         * this indicates that the connection is ready to send and receive data
         */
        this.onopen = undefined;
        this._url = url;
        this._protocols = protocols;
        this._options = options;
        for (const [type] of this.eventToHandler) {
            this._listeners[type] = [];
        }
        this._connect();
    }
    static get CONNECTING() {
        return 0;
    }
    static get OPEN() {
        return 1;
    }
    static get CLOSING() {
        return 2;
    }
    static get CLOSED() {
        return 3;
    }
    get CONNECTING() {
        return ReconnectingWebSocket.CONNECTING;
    }
    get OPEN() {
        return ReconnectingWebSocket.OPEN;
    }
    get CLOSING() {
        return ReconnectingWebSocket.CLOSING;
    }
    get CLOSED() {
        return ReconnectingWebSocket.CLOSED;
    }
    /**
     * Returns the number or connection retries
     */
    get retryCount() {
        return Math.max(this._retryCount, 0);
    }
    /**
     * The number of bytes of data that have been queued using calls to send() but not yet
     * transmitted to the network. This value resets to zero once all queued data has been sent.
     * This value does not reset to zero when the connection is closed; if you keep calling send(),
     * this will continue to climb. Read only
     */
    get bufferedAmount() {
        return this._ws ? this._ws.bufferedAmount : 0;
    }
    /**
     * The extensions selected by the server. This is currently only the empty string or a list of
     * extensions as negotiated by the connection
     */
    get extensions() {
        return this._ws ? this._ws.extensions : '';
    }
    /**
     * A string indicating the name of the sub-protocol the server selected;
     * this will be one of the strings specified in the protocols parameter when creating the
     * WebSocket object
     */
    get protocol() {
        return this._ws ? this._ws.protocol : '';
    }
    /**
     * The current state of the connection; this is one of the Ready state constants
     */
    get readyState() {
        return this._ws ? this._ws.readyState : ReconnectingWebSocket.CONNECTING;
    }
    /**
     * The URL as resolved by the constructor
     */
    get url() {
        return this._ws ? this._ws.url : '';
    }
    /**
     * Closes the WebSocket connection or connection attempt, if any. If the connection is already
     * CLOSED, this method does nothing
     */
    close(code, reason) {
        this._shouldReconnect = false;
        if (!this._ws || this._ws.readyState === this.CLOSED) {
            return;
        }
        this._ws.close(code, reason);
    }
    /**
     * Closes the WebSocket connection or connection attempt and connects again.
     * Resets retry counter;
     */
    reconnect(code, reason) {
        this._shouldReconnect = true;
        this._retryCount = -1;
        if (!this._ws || this._ws.readyState === this.CLOSED) {
            this._connect();
        }
        this._disconnect(code, reason);
        this._connect();
    }
    /**
     * Enqueues the specified data to be transmitted to the server over the WebSocket connection
     */
    send(data) {
        if (this._ws) {
            this._ws.send(data);
        }
    }
    /**
     * Register an event handler of a specific event type
     */
    addEventListener(type, listener) {
        if (this._listeners[type]) {
            this._listeners[type].push(listener);
        }
    }
    /**
     * Removes an event listener
     */
    removeEventListener(type, listener) {
        if (this._listeners[type]) {
            this._listeners[type] = this._listeners[type].filter(l => l !== listener);
        }
    }
    _debug(...params) {
        if (this._options.debug) {
            // tslint:disable-next-line
            console.log('RWS>', ...params);
        }
    }
    _getNextDelay() {
        let delay = 0;
        if (this._retryCount > 0) {
            const { reconnectionDelayGrowFactor = DEFAULT.reconnectionDelayGrowFactor, minReconnectionDelay = DEFAULT.minReconnectionDelay, maxReconnectionDelay = DEFAULT.maxReconnectionDelay, } = this._options;
            delay =
                minReconnectionDelay + Math.pow(this._retryCount - 1, reconnectionDelayGrowFactor);
            if (delay > maxReconnectionDelay) {
                delay = maxReconnectionDelay;
            }
        }
        this._debug('next delay', delay);
        return delay;
    }
    _wait() {
        return new Promise(resolve => {
            setTimeout(resolve, this._getNextDelay());
        });
    }
    /**
     * @return Promise<string>
     */
    _getNextUrl(urlProvider) {
        if (typeof urlProvider === 'string') {
            return Promise.resolve(urlProvider);
        }
        if (typeof urlProvider === 'function') {
            const url = urlProvider();
            if (typeof url === 'string') {
                return Promise.resolve(url);
            }
            if (url.then) {
                return url;
            }
        }
        throw Error('Invalid URL');
    }
    _connect() {
        if (this._connectLock) {
            return;
        }
        this._connectLock = true;
        const { maxRetries = DEFAULT.maxRetries, connectionTimeout = DEFAULT.connectionTimeout, WebSocket = getGlobalWebSocket(), } = this._options;
        if (this._retryCount >= maxRetries) {
            this._debug('max retries reached', this._retryCount, '>=', maxRetries);
            return;
        }
        this._retryCount++;
        this._debug('connect', this._retryCount);
        this._removeListeners();
        if (!isWebSocket(WebSocket)) {
            throw Error('No valid WebSocket class provided');
        }
        this._wait()
            .then(() => this._getNextUrl(this._url))
            .then(url => {
            this._debug('connect', { url, protocols: this._protocols });
            this._ws = new WebSocket(url, this._protocols);
            this._connectLock = false;
            this._addListeners();
            this._connectTimeout = setTimeout(() => this._handleTimeout(), connectionTimeout);
        });
    }
    _handleTimeout() {
        this._debug('timeout event');
        this._handleError(new ErrorEvent(Error('TIMEOUT'), this));
    }
    _disconnect(code, reason) {
        clearTimeout(this._connectTimeout);
        if (!this._ws) {
            return;
        }
        this._removeListeners();
        if (this._ws.readyState === this.CLOSED) {
            return;
        }
        try {
            this._ws.close(code, reason);
            this._handleClose(new CloseEvent(code, reason, this));
        }
        catch (error) {
            if (reason !== 'timeout') {
                this._handleError(new ErrorEvent(error, this));
            }
        }
    }
    _acceptOpen() {
        this._retryCount = 0;
    }
    _handleOpen(event) {
        this._debug('open event');
        const { minUptime = DEFAULT.minUptime } = this._options;
        clearTimeout(this._connectTimeout);
        this._uptimeTimeout = setTimeout(this._acceptOpen, minUptime);
        if (this.onopen) {
            this.onopen(event);
        }
        this._listeners.open.forEach(listener => listener(event));
    }
    _handleMessage(event) {
        this._debug('message event');
        if (this.onmessage) {
            this.onmessage(event);
        }
        this._listeners.message.forEach(listener => listener(event));
    }
    _handleError(event) {
        this._debug('error event', event.message);
        this._disconnect(undefined, event.message === 'TIMEOUT' ? 'timeout' : undefined);
        if (this.onerror) {
            this.onerror(event);
        }
        this._debug('exec error listeners');
        this._listeners.error.forEach(listener => listener(event));
        this._connect();
    }
    _handleClose(event) {
        this._debug('close event');
        if (this.onclose) {
            this.onclose(event);
        }
        this._listeners.close.forEach(listener => listener(event));
    }
    _removeListeners() {
        if (!this._ws) {
            return;
        }
        this._debug('removeListeners');
        for (const [type, handler] of this.eventToHandler) {
            this._ws.removeEventListener(type, handler);
        }
    }
    _addListeners() {
        this._debug('addListeners');
        for (const [type, handler] of this.eventToHandler) {
            this._ws.addEventListener(type, handler);
        }
    }
}

module.exports = ReconnectingWebSocket;
