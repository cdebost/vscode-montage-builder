'use strict';

import * as vscode from 'vscode';
import url = require('url');
import path = require('path');
import { fork } from 'child_process';
import { ReelDocumentContentProvider } from './reel-document-content-provider';
import { IpcMessage, IpcListener } from './shared/ipc';

export function activate(context: vscode.ExtensionContext) {
    activateServer(context);

    const provider = new ReelDocumentContentProvider(context);

    const providerRegistrations = vscode.workspace.registerTextDocumentContentProvider(
        ReelDocumentContentProvider.scheme, provider);

    const commandRegistration = vscode.commands.registerCommand('builder.open', openBuilder);

    context.subscriptions.push(provider, providerRegistrations, commandRegistration);
}

function activateServer(context: vscode.ExtensionContext) {
    const serverModule = context.asAbsolutePath(path.join('out', 'server', 'server.js'));
    const args = ['--nolazy', '--inspect=6009'];
    // Enable IPC
    const options = {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    };

    const server = fork(serverModule, args, options);
    const ipcListener = new IpcListener(server);
    ipcListener.on('ack', message => {
        console.log('ack from child');
    })
    server.send(new IpcMessage('init', {
        montageAppRoot: context.asAbsolutePath('montage-app')
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}

async function openBuilder() {
    if (!checkValidEditor()) {
        return;
    }

    const filename = vscode.window.activeTextEditor.document.fileName;
    const uri = vscode.Uri.parse(`${ReelDocumentContentProvider.scheme}://${encodeURIComponent(filename)}`);

    try {
        await vscode.commands.executeCommand('vscode.previewHtml', uri);
    } catch (err) {
        vscode.window.showErrorMessage(err);
    }
}

function checkValidEditor() : boolean {
    if (!vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage("No document selected.");
        return false;
    }
    return true;
}