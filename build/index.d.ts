declare const ReconnectingWebsocket: (url: string, protocols?: string | string[], options?: {
    constructor?: {
        new (url: string, protocols?: string | string[]): WebSocket;
        prototype: WebSocket;
        CLOSED: number;
        CLOSING: number;
        CONNECTING: number;
        OPEN: number;
    };
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    debug?: boolean;
}) => void;
export = ReconnectingWebsocket;
