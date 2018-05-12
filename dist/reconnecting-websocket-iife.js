var ReconnectingWebSocket = (function () {
    'use strict';

    /*!
     * Reconnecting WebSocket
     * by Pedro Ladaria <pedro.ladaria@gmail.com>
     * https://github.com/pladaria/reconnecting-websocket
     * License MIT
     */
    const getGlobalWebSocket = () => {
        // browser
        if (typeof window !== 'undefined') {
            // @ts-ignore
            return window.WebSocket;
        }
        // node.js / react native
        if (typeof global !== 'undefined') {
            // @ts-ignore
            return global.WebSocket;
        }
        throw Error('Unknown environment');
    };
    const isWebSocket = (w) => typeof w !== 'function' || !w.OPEN;
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
        constructor(url, protocols, options) {
            this._listeners = {
                open: [],
                close: [],
                error: [],
                message: [],
            };
            this._retryCount = 0;
            /**
             * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
             */
            this.onclose = (event) => undefined;
            /**
             * An event listener to be called when an error occurs
             */
            this.onerror = (event) => undefined;
            /**
             * An event listener to be called when a message is received from the server
             */
            this.onmessage = (event) => undefined;
            /**
             * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
             * this indicates that the connection is ready to send and receive data
             */
            this.onopen = (event) => undefined;
            this._url = url;
            this._protocols = protocols;
            this._options = options;
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
            // todo
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
            this._listeners[type] = this._listeners[type] || [];
            this._listeners[type].push(listener);
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
                delay = minReconnectionDelay + Math.pow(this._retryCount - 1, reconnectionDelayGrowFactor);
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
            const { maxRetries = DEFAULT.maxRetries } = this._options;
            if (this._retryCount !== 0 && this._retryCount >= maxRetries) {
                this._debug('max retries reached', maxRetries);
                return;
            }
            this._retryCount++;
            this._debug('connect');
            this._removeListeners();
            const WebSocket = this._options.WebSocket || getGlobalWebSocket();
            if (isWebSocket(WebSocket)) {
                throw Error('No valid WebSocket class provided');
            }
            this._wait()
                .then(() => this._getNextUrl(this._url))
                .then(url => {
                this._debug('connect', { url, protocols: this._protocols });
                this._ws = new WebSocket(url, this._protocols);
                this._addListeners();
            });
        }
        _disconnect() {
            if (!this._ws) {
                return;
            }
            this._removeListeners();
            this._ws.close();
        }
        _acceptOpen() {
            this._retryCount = 0;
        }
        _handleOpen(event) {
            this._debug('open event');
            const { minUptime = DEFAULT.minUptime } = this._options;
            this._uptimeTimeout = setTimeout(this._acceptOpen, minUptime);
            this.onopen(event);
            this._listeners.open.forEach(listener => listener(event));
        }
        _handleMessage(event) {
            this._debug('message event');
            this.onmessage(event);
            this._listeners.message.forEach(listener => listener(event));
        }
        _handleError(event) {
            this._debug('error event');
            this._disconnect();
            this.onerror(event);
            this._listeners.error.forEach(listener => listener(event));
            this._connect();
        }
        _handleClose(event) {
            this._debug('close event');
            this.onclose(event);
            this._listeners.close.forEach(listener => listener(event));
        }
        _removeListeners() {
            if (!this._ws) {
                return;
            }
            this._debug('removeListeners');
            this._ws.removeEventListener('error', event => this._handleError(event));
            this._ws.removeEventListener('close', event => this._handleClose(event));
            this._ws.removeEventListener('message', event => this._handleMessage(event));
            this._ws.removeEventListener('open', event => this._handleOpen(event));
        }
        _addListeners() {
            this._debug('assignListeners');
            this._ws.addEventListener('error', event => this._handleError(event));
            this._ws.addEventListener('close', event => this._handleClose(event));
            this._ws.addEventListener('message', event => this._handleMessage(event));
            this._ws.addEventListener('open', event => this._handleOpen(event));
        }
    }

    return ReconnectingWebSocket;

}());
