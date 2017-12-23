'use strict';

import * as vscode from 'vscode';
import * as Url from 'url';
import { ReelDocumentContentProvider } from './reel-document-content-provider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ReelDocumentContentProvider(context);

    const providerRegistrations = vscode.workspace.registerTextDocumentContentProvider(
        ReelDocumentContentProvider.scheme, provider);

    const commandRegistration = vscode.commands.registerCommand('builder.open', openBuilder);

    context.subscriptions.push(provider, providerRegistrations, commandRegistration);
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