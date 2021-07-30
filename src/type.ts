export enum RPCErrorCode {
    INVALID_METHOD = "INVALID_METHOD",
    INVALID_ARGS = "INVALID_ARGS",
    INVALID_RETURN = "INVALID_RETURN",
    REMOTE_TIMEOUT = "REMOTE_TIMEOUT",
    REMOTE_RUNTIME_ERROR = "REMOTE_RUNTIME_ERROR",
}

export interface PRCMapEntry {
    method: string;
    args: any[];
    onResolve: (result: any) => void;
    onReject: (error: RPCErrorCode) => void;
}

export interface CreateBridgeOptions {
    postMessage: (message: string) => void;
    addMessageListener: (listener: (message: string) => void) => void;
    /**
     * If some RPC invocation has not returned to client (including IO latency) within timeout,
     * then the invocation Promise will be rejected with `REMOTE_TIMEOUT` error.
     *
     * Unit: millisecond
     * Default: 10000
     */
    timeout?: number;
    onRemoteInvokeLocal?: (invokedMethod: string, args: any[]) => void;
    onLocalInvokeRemote?: (invokedMethod: string, args: any[]) => void;
    /**
     * A universal callback handler for all RPC remote errors.
     * If you want to handle only some RPC's error case, use Promise.catch() for the invocation.
     */
    onRemoteError?: (method: string, args: any[], errorCode: RPCErrorCode, errorMessage: string) => void;
    /**
     * A universal callback handler for unexpected errors, such as: malformed message, library bug etc.
     *
     * There is nothing you can do for recovery.
     * Usually you can choose to log and report this error.
     */
    onUnexpectedError?: (error: unknown) => void;
}

export interface BridgeBaseInterface {}

type Promisify<T> = T extends PromiseLike<any> ? T : Promise<T>;
type PromisifyMethodReturn<T> = T extends (...args: infer P) => infer R ? (...args: P) => Promisify<R> : never;

export type PromisifyEveryMethod<T extends BridgeBaseInterface> = {
    [P in keyof T]: PromisifyMethodReturn<T[P]>;
};

// interface Test {
//     a: () => number;
//     b: (x: number[]) => Promise<string>;
//     c: (x: boolean, y: string) => void;
//     d: (x: string[]) => Promise<number> | null;
// }
//
// type X = PromisifyEveryMethod<Test>;
