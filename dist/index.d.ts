interface ReconnectingWebsocket extends WebSocket {
  [key: string]: any;
  new (
    url: string | (() => string),
    protocols?: string | Array<string>,
    options?: {
      [key: string]: any;
      constructor?: new (
        url: string,
        protocols?: string | Array<string>
      ) => WebSocket;
      maxReconnectionDelay?: number;
      minReconnectionDelay?: number;
      reconnectionDelayGrowFactor?: number;
      connectionTimeout?: number;
      maxRetries?: number;
      debug?: boolean;
    }
  ): ReconnectingWebsocket;

  close(
    code?: number,
    reason?: string,
    options?: {
      keepClosed?: boolean;
      fastClosed?: boolean;
      delay?: number;
    }
  ): void;
}

declare const ReconnectingWebsocket: ReconnectingWebsocket;
export = ReconnectingWebsocket;
