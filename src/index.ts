import {BridgeBaseInterface, CreateBridgeOptions, PRCMapEntry, PromisifyEveryMethod, RPCErrorCode} from "./type";
import {InvocationUtil} from "./InvocationUtil";

export function createBridge<LocalProxy extends BridgeBaseInterface, RemoteProxy extends BridgeBaseInterface>(
    localProxy: LocalProxy,
    {
        // prettier-reserve
        postMessage,
        addMessageListener,
        timeout = 10000,
        // TODO: callback
        onRemoteInvokeLocal,
        onLocalInvokeRemote,
        onRemoteError,
        onUnexpectedError,
    }: CreateBridgeOptions
): PromisifyEveryMethod<RemoteProxy> {
    // Promise closure variables
    let promiseAutoIncKey = 0;
    const rpcMap: {[key: number]: PRCMapEntry} = {};

    // Helper functions
    const executeResolveCallback = (key: number, value: any) => {
        const entry = rpcMap[key];
        if (entry) {
            entry.onResolve(value);
            delete rpcMap[key];
        } else {
            // Do nothing, else-flow might be reached if RPC resolves after timeout
        }
    };
    const executeRejectCallback = (key: number, errorCode: RPCErrorCode, errorMessage: string) => {
        const entry = rpcMap[key];
        if (entry) {
            onRemoteError?.(entry.method, entry.args, errorCode, errorMessage);
            entry.onReject(errorCode);
            delete rpcMap[key];
        } else {
            // Do nothing, else-flow might be reached if RPC rejects after timeout
        }
    };
    const executeInvocation = async (key: number, method: string, args: any[]) => {
        const endpoint = localProxy[method];
        if (typeof endpoint === "function") {
            try {
                const result = await endpoint(...args);
                // TODO: distinguish INVALID_RETURN error
                postMessage(InvocationUtil.serializeSuccessCallback({result, key}));
            } catch (e) {
                const errorMessage = InvocationUtil.serializeError(e);
                postMessage(
                    InvocationUtil.serializeErrorCallback({
                        errorCode: RPCErrorCode.REMOTE_RUNTIME_ERROR,
                        errorMessage,
                        key,
                    })
                );
            }
        } else {
            postMessage(
                InvocationUtil.serializeErrorCallback({
                    errorCode: RPCErrorCode.INVALID_METHOD,
                    errorMessage: `Invalid method ${method}`,
                    key,
                })
            );
        }
    };

    // Register local proxy
    addMessageListener(message => {
        let key: number | undefined;

        try {
            const deserializedMessage = InvocationUtil.deserialize(message);
            if (deserializedMessage) {
                if ("result" in deserializedMessage) {
                    // Remote-to-local normal returning
                    const result = deserializedMessage.result;
                    key = deserializedMessage.key;
                    executeResolveCallback(key, result);
                } else if ("errorMessage" in deserializedMessage) {
                    // Remote-to-local error throwing
                    const errorMessage = deserializedMessage.errorMessage;
                    key = deserializedMessage.key;
                    executeRejectCallback(key, RPCErrorCode.REMOTE_RUNTIME_ERROR, errorMessage);
                } else {
                    // Local-to-remote invoking
                    // From here's perspective, it is remote-coming invocation
                    const method = deserializedMessage.method;
                    const args = deserializedMessage.args;
                    key = deserializedMessage.key;
                    executeInvocation(key, method, args);
                }
            } else {
                // Do nothing, this message is unrelated to our library
            }
        } catch (e) {
            onUnexpectedError?.(e);
        }
    });

    // Create remote proxy
    const remoteProxy = {} as PromisifyEveryMethod<RemoteProxy>;
    return new Proxy(remoteProxy, {
        get(target: PromisifyEveryMethod<RemoteProxy>, method: string | symbol): Function | undefined {
            if (typeof method === "string") {
                return (...args: any[]): Promise<any> => {
                    const key = promiseAutoIncKey++;

                    try {
                        postMessage(InvocationUtil.serializeInvocation({method, args, key}));
                        return new Promise((resolve, reject) => {
                            rpcMap[key] = {
                                method,
                                args,
                                onResolve: resolve,
                                onReject: reject,
                            };

                            // Auto reject after timeout, to avoid memory leak
                            setTimeout(() => {
                                executeRejectCallback(key, RPCErrorCode.REMOTE_TIMEOUT, `Remote timeout after ${timeout} ms`);
                            }, timeout);
                        });
                    } catch (e) {
                        onRemoteError?.(method, args, RPCErrorCode.INVALID_ARGS, "Args not serializable");
                        return Promise.reject(RPCErrorCode.INVALID_ARGS);
                    }
                };
            } else {
                return undefined;
            }
        },
    });
}

export {RPCErrorCode};
