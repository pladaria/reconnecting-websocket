interface ReconnectingWebsocket extends WebSocket {
    [key: string]: any;
}
declare const ReconnectingWebsocket: (url: string | (() => string), protocols?: string | string[], options?: {
    [key: string]: any;
    constructor?: new (url: string, protocols?: string | string[]) => WebSocket;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    debug?: boolean;
}) => void;
export = ReconnectingWebsocket;
