export declare class Event {
    target: any;
    type: string;
    constructor(type: string, target: any);
}
export declare class ErrorEvent extends Event {
    message: string;
    error: Error;
    constructor(error: Error, target: any);
}
export declare class CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;
    constructor(code: number | undefined, reason: string | undefined, target: any);
}
export declare type EventListener = (event: Event) => undefined;
