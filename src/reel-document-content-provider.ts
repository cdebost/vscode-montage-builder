'use strict';

import * as vscode from 'vscode';
import { TextDocumentContentProvider, ExtensionContext, Uri, EventEmitter, Event } from 'vscode';
import * as fs from 'fs';
import * as Url from 'url';

/**
 * Reponsible for rendering the contents of a reel document.
 */
export class ReelDocumentContentProvider implements TextDocumentContentProvider {
    static scheme : string = 'reel-preview';

    private _context : ExtensionContext;
    private _montageAppRoot : string;
    private _montageApp : string;
    private _onDidChange = new EventEmitter<Uri>();

    constructor(context : ExtensionContext) {
        this._context = context;
        this._montageAppRoot = context.asAbsolutePath('montage-app/');
        this._montageApp = fs.readFileSync(this.montageRelative('index.html'), 'UTF-8');
    }

    provideTextDocumentContent(uri: Uri) : Promise<string> {
        const filename = decodeURIComponent(uri.authority);
        const document = vscode.workspace.textDocuments.find(d => d.fileName.toLowerCase() === filename.toLowerCase());

        const content = this._montageApp.replace('{baseUrl}',
            this.addFilePrefix(this._montageAppRoot)
        );

        return Promise.resolve(content);
    }

    dispose() {

    }

    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }

    public update(uri: Uri) {
        this._onDidChange.fire(uri);
    }

    private montageRelative(url: string) : string {
        return Url.resolve(this._montageAppRoot, url);
    }

    private addFilePrefix(url: string) : string {
        return (url[0] === '/' ? 'file://' : 'file:///') + url;
    }
}