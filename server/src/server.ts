'use strict';

import { IpcMessage, IpcListener } from '../../src/shared/ipc';

const ipcListener = new IpcListener(process);

let montageAppRoot;

ipcListener.on('init', message => {
    montageAppRoot = message.montageAppRoot;
    ipcListener.send(new IpcMessage('ack', { root: montageAppRoot }));
});
