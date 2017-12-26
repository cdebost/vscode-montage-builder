'use strict';

import process = require('process');

export class IpcMessage {
    type: string;
    detail: object;

    constructor(type: string, detail?: object) {
        this.type = type;
        this.detail = detail;
    }
}

export class IpcListener {
    private process;
    private handlers: Map<string, [Function]> = new Map();

    constructor(process) {
        this.process = process;

        process.on('message', (message: IpcMessage) => {
            const type = message.type;
            if (this.handlers.has(type)) {
                const handlers = this.handlers.get(type);
                handlers.forEach(handler => handler(message.detail));
            } else {
                const handlers = this.handlers.get('*');
                handlers.forEach(handler => handler(message.detail));
            }
        });
    }

    send(message: IpcMessage) {
        process.send(message);
    }

    on(type: string, handler: Function) {
        if (this.handlers.has(type)) {
            this.handlers.get(type).push(handler);
        } else {
            this.handlers.set(type, [handler]);
        }
    }
}
