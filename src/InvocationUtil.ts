import {RPCErrorCode} from "./type";

type InvocationMessage = {method: string; args: any[]; key: number};
type SuccessCallbackMessage = {result: any; key: number};
type ErrorCallbackMessage = {errorCode: RPCErrorCode; errorMessage: string; key: number}; // Hard to keep the error object through serialization

type SerializedMessage = InvocationMessage | SuccessCallbackMessage | ErrorCallbackMessage;

const BRIDGE_PREFIX = "@@BRIDGE::";

function serializeInvocation(payload: InvocationMessage): string {
    return BRIDGE_PREFIX + checkedStringify(payload);
}

function serializeSuccessCallback(payload: SuccessCallbackMessage): string {
    return BRIDGE_PREFIX + checkedStringify(payload);
}

function serializeErrorCallback(payload: ErrorCallbackMessage): string {
    return BRIDGE_PREFIX + checkedStringify(payload);
}

function serializeError(error: unknown): string {
    if (error) {
        if (error instanceof Error) {
            return `[${error.name}]: ${error.message}`;
        } else {
            try {
                return JSON.stringify(error);
            } catch (e) {
                return "[Unknown Error]";
            }
        }
    } else {
        return "[Empty Error]";
    }
}

function deserialize(message: string): SerializedMessage | null {
    if (message.startsWith(BRIDGE_PREFIX)) {
        const messageWithoutPrefix = message.substr(BRIDGE_PREFIX.length);
        try {
            const message: SerializedMessage = JSON.parse(messageWithoutPrefix);
            return message;
        } catch (e) {
            throw new Error(`Cannot parse message: ${messageWithoutPrefix}`);
        }
    } else {
        return null;
    }
}

function checkedStringify(data: any): string {
    // TODO: support undefined here
    // TODO: check logic
    return JSON.stringify(data);
}

export const InvocationUtil = Object.freeze({
    serializeInvocation,
    serializeSuccessCallback,
    serializeErrorCallback,
    serializeError,
    deserialize,
});
