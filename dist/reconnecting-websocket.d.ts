/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
export declare type Options = {
    WebSocket?: any;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    minUptime?: number;
    reconnectionDelayGrowFactor?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    debug?: boolean;
};
export declare type UrlProvider = string | (() => string) | (() => Promise<string>);
export default class ReconnectingWebSocket {
    private _ws;
    private _listeners;
    private _retryCount;
    private readonly _url;
    private readonly _protocols;
    private readonly _options;
    private _uptimeTimeout;
    private _connectTimeout;
    constructor(url: UrlProvider, protocols: string | string[] | undefined, options: Options);
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSING: number;
    readonly CLOSED: number;
    /**
     * The number of bytes of data that have been queued using calls to send() but not yet
     * transmitted to the network. This value resets to zero once all queued data has been sent.
     * This value does not reset to zero when the connection is closed; if you keep calling send(),
     * this will continue to climb. Read only
     */
    readonly bufferedAmount: number;
    /**
     * The extensions selected by the server. This is currently only the empty string or a list of
     * extensions as negotiated by the connection
     */
    readonly extensions: string;
    /**
     * A string indicating the name of the sub-protocol the server selected;
     * this will be one of the strings specified in the protocols parameter when creating the
     * WebSocket object
     */
    readonly protocol: string;
    /**
     * The current state of the connection; this is one of the Ready state constants
     */
    readonly readyState: number;
    /**
     * The URL as resolved by the constructor
     */
    readonly url: string;
    /**
     * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
     */
    onclose: (event: CloseEvent) => undefined;
    /**
     * An event listener to be called when an error occurs
     */
    onerror: (event: Event) => undefined;
    /**
     * An event listener to be called when a message is received from the server
     */
    onmessage: (event: MessageEvent) => undefined;
    /**
     * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
     * this indicates that the connection is ready to send and receive data
     */
    onopen: (event: Event) => undefined;
    /**
     * Closes the WebSocket connection or connection attempt, if any. If the connection is already
     * CLOSED, this method does nothing
     */
    close(code?: number, reason?: string): void;
    /**
     * Enqueues the specified data to be transmitted to the server over the WebSocket connection
     */
    send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
    /**
     * Register an event handler of a specific event type
     */
    addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: EventListener): void;
    /**
     * Removes an event listener
     */
    removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: EventListener): void;
    private _debug(...params);
    private _getNextDelay();
    private _wait();
    private _getNextUrl(urlProvider);
    private _connect();
    private _disconnect();
    private _acceptOpen();
    private _handleOpen(event);
    private _handleMessage(event);
    private _handleError(event);
    private _handleClose(event);
    private _removeListeners();
    private _addListeners();
}
