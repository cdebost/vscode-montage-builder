'use strict';

import { ReelReviver } from '../../montage-app/core/serialization/reel-reviver.js';
import { ReelContext } from '../../montage-app/core/serialization/reel-context.js';
import { ReelSerializer } from '../../montage-app/core/serialization/reel-serializer.js';
import { SORTERS } from '../../montage-app/node_modules/palette/core/sorters.js';
import { Url } from '../../montage-app/core/url.js';
import { MontageReviver } from '../../montage-app/node_modules/montage/core/serialization/deserializer/montage-reviver.js';

export class ReelDocument {
    private _url: string;
    private _dataSource;
    private _packageRequire;
    private _moduleId: string;
    private _exportName: string;
    private _editingProxyMap = {};
    private _selectedObjects = [];
    private _highlightedElements = [];
    private _errors = [];

    constructor(fileUrl: string, dataSource, packageRequire) {
        this._url = fileUrl;
        this._dataSource = dataSource;
        this._packageRequire = packageRequire;

        this._moduleId = Url.toModuleId(fileUrl, packageRequire.location);
        this._exportName = MontageReviver.parseObjectLocationId(this._moduleId).objectName;
    }

    get title() {
        return decodeURI(this._url.match(/\/([^\/]+)\/*$/)[1]);
    }

    load() {
        const packageUrl = this._packageRequire.location;
        const moduleId = Url.toModuleId(this._url, packageUrl);
        const templateModuleId = this._getTemplateModuleId(moduleId);

        return Promise.all([
            this._createTemplateWithUrl(packageUrl + templateModuleId),
            this._dataSource.read(this._getJsFileUrl())
        ]).spread((template, javascript) => {
            this._dataSource.addEventListener("dataChange", this, false);
            this._template = template;
            this._javascript = javascript;
            this.registerFile("html", this._saveHtml, this);
            this.registerFile("js", this._saveJs, this);
            this.registerFile("meta", this._saveMeta, this);
            this._openTemplate(template);
            return this;
        }, (error) => {
            var wrappedError = {
                file: this._url,
                error: {
                    id: "syntaxError",
                    reason: "Template was not found or was invalid"
                },
                stack: error.stack
            };
            this._errors.push(wrappedError);
        })
        .then(() => {
            if (this._errors.length) {
                console.error("Errors loading document", this._errors);
            }
            return this;
        });
    }

    private _getTemplateModuleId(moduleId: string): string {
        return moduleId.replace(/\/([^/]+).reel$/, "/$1.reel/$1.html");
    }

    private _createTemplateWithUrl(url) {
        var self = this;

        return this._dataSource.read(url)
        .then(function (templateContent) {
            // Create the document for the template ourselves to avoid any massaging
            // we might do for templates intended for use; namely, rebasing resources
            var htmlDocument = document.implementation.createHTMLDocument("");
            htmlDocument.documentElement.innerHTML = templateContent;
            return new Template().initWithDocument(htmlDocument, self._packageRequire);
        });
    }

    deserializationContext(serialization, objects): ReelContext {
        const context = new ReelContext().init(serialization, new ReelReviver(), objects);
        context.editingDocument = this;
        return context;
    }

    private _buildSerializationObjects() {
        return {};
    }

    serializationForProxy(proxy) {
        const serializer = new ReelSerializer().initWithRequire(this._packageRequire);
        const serialization = JSON.parse(serializer.serializeObject(proxy))[proxy.label];
        return SORTERS.unitSorter(serialization);
    }

    getOwnedObjectProperty(proxy, property) {
        return proxy.getObjectProperty(property);
    }

    getOwnedObjectProperties(proxy, properties) {
        return proxy.getObjectProperties(properties);
    }

    setOwnedObjectProperty(proxy, property, value) {
        proxy.setObjectProperty(property, value);
    }

    deleteOwnedObjectProperty(proxy, property) {
        proxy.deleteObjectProperty(property);
    }

    setOwnedObjectProperties(proxy, values) {
        //TODO maybe the proxy shouldn't be involved in doing this as we hand out the proxies
        // throughout the editingEnvironment, I don't want to expose accessible editing APIs
        // that do not go through the editingDocument...or do I?

        // Might be nice to have an editing API that avoids undoability and event dispatching?
        proxy.setObjectProperties(values);
    }

    setOwnedObjectLabel(proxy, newLabel) {
        const proxyMap = this._editingProxyMap,
            oldLabel = proxy.label;

        //TODO report an error when given an invalid label e.g. no label or label already exists
        if (newLabel && !proxyMap[newLabel]) {
            // add new label and current reference in editingProxyMap
            proxyMap[newLabel] = proxy;
            delete proxyMap[oldLabel];

            //TODO dispatch change for identifier etc.?
            proxy.label = newLabel;

            return true;
        }
        return false;
    }

    // Editing model

    private _addProxies(proxies) {
        if (Array.isArray(proxies)) {
            proxies.forEach(proxy => this._addProxy(proxy));
        } else {
            this._addProxy(proxies);
        }
    }

    private _addProxy(proxy) {
        const proxyMap = this._editingProxyMap;

        proxyMap[proxy.label] = proxy;

        //TODO not simply stick this on the object; the inspector needs it right now
        proxy.packageRequire = this._packageRequire;
    }

    private _replaceProxies(proxies) {
        this._editingProxyMap = {};
        proxies.forEach(proxy => this._addProxy(proxy));
    }

    private _removeProxies(proxies) {
        if (Array.isArray(proxies)) {
            proxies.forEach(proxy => this._removeProxy(proxy));
        } else {
            this._removeProxy(proxies);
        }
    }

    private _removeProxy(proxy) {
        const proxyMap = this._editingProxyMap;

        if (!proxyMap.hasOwnProperty(proxy.label)) {
            throw new Error("Could not find proxy to remove with label '" + proxy.label + "'");
        }
        delete proxyMap[proxy.label];
    }
}