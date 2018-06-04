/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
import {CloseEvent, ErrorEvent, Event, EventListener, WebSocketEventMap} from './events';

const getGlobalWebSocket = (): WebSocket | undefined => {
    if (typeof WebSocket !== 'undefined') {
        // @ts-ignore
        return WebSocket;
    }
};

/**
 * Returns true if given argument looks like a WebSocket class
 */
const isWebSocket = (w: any) => typeof w === 'function' && w.CLOSING === 2;

export type Options = {
    WebSocket?: any;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    minUptime?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    debug?: boolean;
};

const DEFAULT = {
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1000 + Math.random() * 4000,
    minUptime: 5000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: false,
};

export type UrlProvider = string | (() => string) | (() => Promise<string>);

export type ListenersMap = {
    error: Array<((event: ErrorEvent) => void)>;
    message: Array<((event: MessageEvent) => void)>;
    open: Array<((event: Event) => void)>;
    close: Array<((event: CloseEvent) => void)>;
};
export default class ReconnectingWebSocket {
    private _ws?: WebSocket;
    private _listeners: ListenersMap = {
        error: [],
        message: [],
        open: [],
        close: [],
    };
    private _retryCount = -1;
    private _uptimeTimeout: any;
    private _connectTimeout: any;
    private _shouldReconnect = true;
    private _connectLock = false;
    private _binaryType = 'blob';

    private readonly _url: UrlProvider;
    private readonly _protocols?: string | string[];
    private readonly _options: Options;

    private readonly eventToHandler = new Map<keyof WebSocketEventMap, any>([
        ['open', this._handleOpen.bind(this)],
        ['close', this._handleClose.bind(this)],
        ['error', this._handleError.bind(this)],
        ['message', this._handleMessage.bind(this)],
    ]);

    constructor(url: UrlProvider, protocols?: string | string[], options: Options = {}) {
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

    get binaryType(): string {
        return this._ws ? this._ws.binaryType : this._binaryType;
    }

    set binaryType(value: string) {
        this._binaryType = value;
        if (this._ws) {
            // @ts-ignore
            this._ws.binaryType = value;
        }
    }

    /**
     * Returns the number or connection retries
     */
    get retryCount(): number {
        return Math.max(this._retryCount, 0);
    }

    /**
     * The number of bytes of data that have been queued using calls to send() but not yet
     * transmitted to the network. This value resets to zero once all queued data has been sent.
     * This value does not reset to zero when the connection is closed; if you keep calling send(),
     * this will continue to climb. Read only
     */
    get bufferedAmount(): number {
        return this._ws ? this._ws.bufferedAmount : 0;
    }

    /**
     * The extensions selected by the server. This is currently only the empty string or a list of
     * extensions as negotiated by the connection
     */
    get extensions(): string {
        return this._ws ? this._ws.extensions : '';
    }

    /**
     * A string indicating the name of the sub-protocol the server selected;
     * this will be one of the strings specified in the protocols parameter when creating the
     * WebSocket object
     */
    get protocol(): string {
        return this._ws ? this._ws.protocol : '';
    }

    /**
     * The current state of the connection; this is one of the Ready state constants
     */
    get readyState(): number {
        return this._ws ? this._ws.readyState : ReconnectingWebSocket.CONNECTING;
    }

    /**
     * The URL as resolved by the constructor
     */
    get url(): string {
        return this._ws ? this._ws.url : '';
    }

    /**
     * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
     */
    public onclose?: (event: CloseEvent) => void = undefined;

    /**
     * An event listener to be called when an error occurs
     */
    public onerror?: (event: Event) => void = undefined;

    /**
     * An event listener to be called when a message is received from the server
     */
    public onmessage?: (event: MessageEvent) => void = undefined;

    /**
     * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
     * this indicates that the connection is ready to send and receive data
     */
    public onopen?: (event: Event) => void = undefined;

    /**
     * Closes the WebSocket connection or connection attempt, if any. If the connection is already
     * CLOSED, this method does nothing
     */
    public close(code?: number, reason?: string) {
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
    public reconnect(code?: number, reason?: string) {
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
    public send(data: string | ArrayBuffer | Blob | ArrayBufferView) {
        if (this._ws) {
            this._ws.send(data);
        }
    }

    /**
     * Register an event handler of a specific event type
     */
    public addEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: ((event: WebSocketEventMap[K]) => void),
    ): void {
        if (this._listeners[type]) {
            // @ts-ignore
            this._listeners[type].push(listener);
        }
    }

    /**
     * Removes an event listener
     */
    public removeEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: ((event: WebSocketEventMap[K]) => void),
    ): void {
        if (this._listeners[type]) {
            // @ts-ignore
            this._listeners[type] = this._listeners[type].filter(l => l !== listener);
        }
    }

    private _debug(...params: any[]) {
        if (this._options.debug) {
            // tslint:disable-next-line
            console.log('RWS>', ...params);
        }
    }

    private _getNextDelay() {
        let delay = 0;
        if (this._retryCount > 0) {
            const {
                reconnectionDelayGrowFactor = DEFAULT.reconnectionDelayGrowFactor,
                minReconnectionDelay = DEFAULT.minReconnectionDelay,
                maxReconnectionDelay = DEFAULT.maxReconnectionDelay,
            } = this._options;

            delay =
                minReconnectionDelay + Math.pow(this._retryCount - 1, reconnectionDelayGrowFactor);
            if (delay > maxReconnectionDelay) {
                delay = maxReconnectionDelay;
            }
        }
        this._debug('next delay', delay);
        return delay;
    }

    private _wait(): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, this._getNextDelay());
        });
    }

    /**
     * @return Promise<string>
     */
    private _getNextUrl(urlProvider: UrlProvider): Promise<string> {
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

    private _connect() {
        if (this._connectLock) {
            return;
        }
        this._connectLock = true;

        const {
            maxRetries = DEFAULT.maxRetries,
            connectionTimeout = DEFAULT.connectionTimeout,
            WebSocket = getGlobalWebSocket(),
        } = this._options;

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
                this._debug('connect', {url, protocols: this._protocols});
                this._ws = new WebSocket(url, this._protocols);
                // @ts-ignore
                this._ws!.binaryType = this._binaryType;
                this._connectLock = false;
                this._addListeners();
                this._connectTimeout = setTimeout(() => this._handleTimeout(), connectionTimeout);
            });
    }

    private _handleTimeout() {
        this._debug('timeout event');
        this._handleError(new ErrorEvent(Error('TIMEOUT'), this));
    }

    private _disconnect(code?: number, reason?: string) {
        clearTimeout(this._connectTimeout);
        if (!this._ws) {
            return;
        }
        this._removeListeners();
        try {
            this._ws.close(code, reason);
            this._handleClose(new CloseEvent(code, reason, this));
        } catch (error) {
            // ignore
        }
    }

    private _acceptOpen() {
        this._retryCount = 0;
    }

    private _handleOpen(event: Event) {
        this._debug('open event');
        const {minUptime = DEFAULT.minUptime} = this._options;

        clearTimeout(this._connectTimeout);
        this._uptimeTimeout = setTimeout(() => this._acceptOpen(), minUptime);

        this._debug('assign binary type');
        // @ts-ignore
        this._ws!.binaryType = this._binaryType;

        if (this.onopen) {
            this.onopen(event);
        }
        this._listeners.open.forEach(listener => listener(event));
    }

    private _handleMessage(event: MessageEvent) {
        this._debug('message event');

        if (this.onmessage) {
            this.onmessage(event);
        }
        this._listeners.message.forEach(listener => listener(event));
    }

    private _handleError(event: ErrorEvent) {
        this._debug('error event', event.message);
        this._disconnect(undefined, event.message === 'TIMEOUT' ? 'timeout' : undefined);

        if (this.onerror) {
            this.onerror(event);
        }
        this._debug('exec error listeners');
        this._listeners.error.forEach(listener => listener(event));

        this._connect();
    }

    private _handleClose(event: CloseEvent) {
        this._debug('close event');

        if (this.onclose) {
            this.onclose(event);
        }
        this._listeners.close.forEach(listener => listener(event));
    }

    /**
     * Remove event listeners to WebSocket instance
     */
    private _removeListeners() {
        if (!this._ws) {
            return;
        }
        this._debug('removeListeners');
        for (const [type, handler] of this.eventToHandler) {
            this._ws.removeEventListener(type, handler);
        }
    }

    /**
     * Assign event listeners to WebSocket instance
     */
    private _addListeners() {
        this._debug('addListeners');
        for (const [type, handler] of this.eventToHandler) {
            this._ws!.addEventListener(type, handler);
        }
    }
}
