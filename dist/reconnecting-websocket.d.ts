/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
import * as Events from './events';
export declare type Event = Events.Event;
export declare type ErrorEvent = Events.ErrorEvent;
export declare type CloseEvent = Events.CloseEvent;
export declare type Options = {
    WebSocket?: any;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    minUptime?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    maxEnqueuedMessages?: number;
    startClosed?: boolean;
    debug?: boolean;
};
export declare type UrlProvider = string | (() => string) | (() => Promise<string>);
export declare type Message = string | ArrayBuffer | Blob | ArrayBufferView;
export declare type ListenersMap = {
    error: Array<Events.WebSocketEventListenerMap['error']>;
    message: Array<Events.WebSocketEventListenerMap['message']>;
    open: Array<Events.WebSocketEventListenerMap['open']>;
    close: Array<Events.WebSocketEventListenerMap['close']>;
};
export default class ReconnectingWebSocket {
    private _ws?;
    private _listeners;
    private _retryCount;
    private _uptimeTimeout;
    private _connectTimeout;
    private _shouldReconnect;
    private _connectLock;
    private _binaryType;
    private _closeCalled;
    private _messageQueue;
    private readonly _url;
    private readonly _protocols?;
    private readonly _options;
    constructor(url: UrlProvider, protocols?: string | string[], options?: Options);
    static get CONNECTING(): number;
    static get OPEN(): number;
    static get CLOSING(): number;
    static get CLOSED(): number;
    get CONNECTING(): number;
    get OPEN(): number;
    get CLOSING(): number;
    get CLOSED(): number;
    get binaryType(): BinaryType;
    set binaryType(value: BinaryType);
    /**
     * Returns the number or connection retries
     */
    get retryCount(): number;
    /**
     * The number of bytes of data that have been queued using calls to send() but not yet
     * transmitted to the network. This value resets to zero once all queued data has been sent.
     * This value does not reset to zero when the connection is closed; if you keep calling send(),
     * this will continue to climb. Read only
     */
    get bufferedAmount(): number;
    /**
     * The extensions selected by the server. This is currently only the empty string or a list of
     * extensions as negotiated by the connection
     */
    get extensions(): string;
    /**
     * A string indicating the name of the sub-protocol the server selected;
     * this will be one of the strings specified in the protocols parameter when creating the
     * WebSocket object
     */
    get protocol(): string;
    /**
     * The current state of the connection; this is one of the Ready state constants
     */
    get readyState(): number;
    /**
     * The URL as resolved by the constructor
     */
    get url(): string;
    /**
     * An event listener to be called when the WebSocket connection's readyState changes to CLOSED
     */
    onclose: ((event: Events.CloseEvent) => void) | null;
    /**
     * An event listener to be called when an error occurs
     */
    onerror: ((event: Events.ErrorEvent) => void) | null;
    /**
     * An event listener to be called when a message is received from the server
     */
    onmessage: ((event: MessageEvent) => void) | null;
    /**
     * An event listener to be called when the WebSocket connection's readyState changes to OPEN;
     * this indicates that the connection is ready to send and receive data
     */
    onopen: ((event: Event) => void) | null;
    /**
     * Closes the WebSocket connection or connection attempt, if any. If the connection is already
     * CLOSED, this method does nothing
     */
    close(code?: number, reason?: string): void;
    /**
     * Closes the WebSocket connection or connection attempt and connects again.
     * Resets retry counter;
     */
    reconnect(code?: number, reason?: string): void;
    /**
     * Enqueue specified data to be transmitted to the server over the WebSocket connection
     */
    send(data: Message): void;
    /**
     * Register an event handler of a specific event type
     */
    addEventListener<T extends keyof Events.WebSocketEventListenerMap>(type: T, listener: Events.WebSocketEventListenerMap[T]): void;
    dispatchEvent(event: Event): boolean;
    /**
     * Removes an event listener
     */
    removeEventListener<T extends keyof Events.WebSocketEventListenerMap>(type: T, listener: Events.WebSocketEventListenerMap[T]): void;
    private _debug;
    private _getNextDelay;
    private _wait;
    private _getNextUrl;
    private _connect;
    private _handleTimeout;
    private _disconnect;
    private _acceptOpen;
    private _callEventListener;
    private _handleOpen;
    private _handleMessage;
    private _handleError;
    private _handleClose;
    private _removeListeners;
    private _addListeners;
    private _clearTimeouts;
}
