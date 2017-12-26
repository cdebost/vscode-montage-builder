'use strict';

import { IpcMessage, IpcListener } from '../shared/ipc';

const ipcListener = new IpcListener(process);

let montageAppRoot;

class InitConfig {
    montageAppRoot: string;
}

ipcListener.on('init', message => {
    const config = message as InitConfig;
    initServer(config);
    ipcListener.ack();
});

function initServer(config: InitConfig) {
    montageAppRoot = config.montageAppRoot;
}
