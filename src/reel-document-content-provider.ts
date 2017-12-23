'use strict';

import * as vscode from 'vscode';
import { TextDocumentContentProvider, ExtensionContext, Uri, workspace } from 'vscode';

/**
 * Reponsible for rendering the contents of a reel document.
 */
export class ReelDocumentContentProvider implements TextDocumentContentProvider {
    static scheme : string = 'reel-preview';

    private _context : ExtensionContext;

    constructor(context : ExtensionContext) {
        this._context = context;
    }

    provideTextDocumentContent(uri: Uri) : Promise<string> {
        const filename = decodeURIComponent(uri.authority);
        const document = vscode.workspace.textDocuments.find(d => d.fileName.toLowerCase() === filename.toLowerCase());
        return Promise.resolve(`<html><body>Hello world from ${document.fileName}</body></html>`);
    }

    dispose() {

    }
}