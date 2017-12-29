'use strict';

import { JSDOM } from 'jsdom';
import { NodeProxy } from './node-proxy';
import { ReelProxy } from './reel-proxy';
import { TemplateFormatter } from './template-formatter';
import { parseObjectLocationId } from '../util/montage-utils';
import { ReelReviver } from './serialization/reel-reviver';
import { ReelContext } from './serialization/reel-context';
import { ReelSerializer } from './serialization/reel-serializer';
import Url = require('../util/url');

import { SORTERS } from '../../montage-app/node_modules/palette/core/sorters.js';
import { Template } from '../../montage-app/node_modules/montage/core/template';
import { MontageSerializer } from '../../montage-app/node_modules/montage/core/serialization/serializer/montage-serializer.js';

export class ReelDocument {
    private _url: string;
    private _dataSource;
    private _packageRequire;
    private _moduleId: string;
    private _exportName: string;
    private _template: Template;
    private _javascript: string;
    public templateNodes: NodeProxy[];
    private _templateBodyNode: NodeProxy;
    private __ownerBlueprint: Promise<[any, any, any]>;
    private _propertyBlueprintConstructor: any;
    private _eventBlueprintConstructor: any;

    private _editingProxyMap: any = {};
    private _selectedObjects = [];
    private _highlightedElements = [];
    private _errors = [];
    private _registeredFiles = {};
    private _hasModifiedData = {undoCount: 0, redoCount: 0};
    private _isJavascriptModified = false;
    public templateObjectsTree = {};
    public templateObjectsTreeToggleStates: WeakMap<object, any>;
    private _ignoreDataChange = false;

    constructor(fileUrl: string, dataSource, packageRequire) {
        this._url = fileUrl;
        this._dataSource = dataSource;
        this._packageRequire = packageRequire;


        this._moduleId = Url.toModuleId(fileUrl, packageRequire.location);
        this._exportName = parseObjectLocationId(this._moduleId).objectName;
    }

    get title() {
        return decodeURI(this._url.match(/\/([^\/]+)\/*$/)[1]);
    }

    get editingProxyMap() {
        return this._editingProxyMap;
    }

    load() {
        const packageUrl = this._packageRequire.location;
        const moduleId = Url.toModuleId(this._url, packageUrl);
        const templateModuleId = this._getTemplateModuleId(moduleId);

        return Promise.all([
            this._createTemplateWithUrl(packageUrl + templateModuleId),
            this._dataSource.read(this._jsFileUrl)
        ]).then(([template, javascript]) => {
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
        return this._dataSource.read(url).then((templateContent) => {
            // Create the document for the template ourselves to avoid any massaging
            // we might do for templates intended for use; namely, rebasing resources
            const { document } = new JSDOM(templateContent).window;
            return new Template().initWithDocument(document, this._packageRequire);
        });
    }

    private _openTemplate(template) {
        let error,
            editingProxyMap,
            context;

        if (this.templateNodes) {
            this.templateNodes.forEach(nodeProxy => nodeProxy.destroy());
        }

        editingProxyMap = this._editingProxyMap;
        for (var key in editingProxyMap) {
            if (editingProxyMap.hasOwnProperty(key) && editingProxyMap[key]) {
                editingProxyMap[key].destroy();
            }
        }

        // this.undoManager.clearUndo();
        // this.undoManager.clearRedo();
        this._resetModifiedDataState();

        this._template = template;
        this._templateBodyNode = new NodeProxy(template.document.body, this);
        this.templateNodes = this._children(this._templateBodyNode);

        this._errors = [];
        try {
            var serialization = JSON.parse(template.getInlineObjectsString(template.document));
            if (serialization) {
                context = this.deserializationContext(serialization);
                context.ownerExportId = this._moduleId;
                this._replaceProxies(context.getObjects());
            }
        } catch (e) {

            error = {
                file: this._url,
                error: {
                    id: "serializationError",
                    reason: e.message,
                    stack: e.stack
                }
            };
            this._errors.push(error);

        }
        this.buildTemplateObjectTree();
    }

    nodeProxyForMontageId(montageId: string): NodeProxy {
        return this.templateNodes.find(node => node.montageId === montageId);
    }

    private _children(node, depth?: number): NodeProxy[] {
        if (!depth) {
            depth = 0;
        }

        if (!node) {
            return;
        } else {
            node.depth = depth;
            if (node.children) {
                let array = [node];

                node.children.forEach((child) => {
                    array = array.concat(this._children(child, depth + 1));
                });

                return array;
            } else {
                return [node];
            }
        }
    }

    deserializationContext(serialization, objects?) {
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
    
    buildTemplateObjectTree() {
        this.templateObjectsTree = this.createTemplateObjectTree();
    }

    /*
        Build the templateObjectsTree from the templatesNodes
        Steps:
            - add the root element
            - create a list of components to be arranged in the tree, "proxyFIFO"
            - pick the head element, "nodeProxy" of the list and try to add it to the tree.
              While adding to the tree we keep a map of elements to tree node updated.
            - if the element has no DOM representation it is added to the root of the tree as first child
            - otherwise we seek the element's parentComponent to then add it
            - if the parentComponent has not yet been added we postpone adding this node for later by pushing back into the FIFO
    */
    createTemplateObjectTree() {
        const successivePushes = {number: 0};
        // map of ReelProxy to tree node, for quick tree node access
        const insertionMap = new WeakMap();
        // add the root
        const root = this._buildTreeAddRoot(insertionMap);
        // filling the FIFO
        const proxyFIFO = this._buildTreeFillFIFO();
        let reelProxy;

        while (reelProxy = proxyFIFO.shift()) {
            if (this._reelProxyHasElementProperty(reelProxy)) {
                this._addNodeWithDOM(reelProxy, root, insertionMap, proxyFIFO, successivePushes);
            } else {
                this._addNodeWithoutDOM(reelProxy, root);
            }
            // to be safe, guard to prevent an infinite loop
            if (successivePushes.number > proxyFIFO.length) {
                throw new Error("Can not build templateObjectsTree: looping on the same components");
            }
        }
        this.templateObjectsTreeToggleStates = new WeakMap<object, any>();
        return root;
    }

    // Subroutines for buildTemplateObjectTree
    private _buildTreeAddRoot(insertionMap: WeakMap<object, any>) {
        const ownerObject = this._editingProxyMap.owner;
        const root = {
            templateObject: ownerObject,
            expanded: true,
            children: []
        };
        insertionMap.set(ownerObject, root);
        return root;
    }

    private _buildTreeFillFIFO() {
        const proxyMap = this._editingProxyMap;
        const ownerObject = proxyMap.owner;

        return Object.keys(proxyMap).reduce((fifo, componentName) => {
            const component = proxyMap[componentName];
            // we remove the owner as it is added as the root
            if (component !== ownerObject) {
                fifo.push(component);
            }
            return fifo;
        }, []);
    }

    private _reelProxyHasElementProperty(reelProxy: ReelProxy) {
        return reelProxy.properties && reelProxy.properties.get('element');
    }

    private _addNodeWithDOM(reelProxy: ReelProxy, root, insertionMap: WeakMap<object, any>,
                            proxyFIFO, successivePushes) {
        // find the parent component
        const parentReelProxy = this._buildTreeFindParentComponent(reelProxy);
        if (!parentReelProxy) {
            this._addOrphanToRoot(root, reelProxy);
            return;
        }

        if (insertionMap.has(parentReelProxy)) {
            this._addNodeToTree(reelProxy, insertionMap, parentReelProxy);

            // reset the infinite loop guard
            successivePushes.number = 0;
        } else {
            // parentReelProxy not found -> has not been added to the tree yet
            proxyFIFO.push(reelProxy);
            successivePushes.number++;
        }
    }

    private _buildTreeFindParentComponent(reelProxy: ReelProxy) {
        const nodeProxy = reelProxy.properties.get('element');
        let parentNodeProxy = nodeProxy;
        let parentReelProxy;
        while (parentNodeProxy = parentNodeProxy.parentNode) {
            if (parentNodeProxy.component) {
                parentReelProxy = parentNodeProxy.component;
                break;
            }
        }
        return parentReelProxy;
    }

    private _addOrphanToRoot(root, reelProxy: ReelProxy) {
        // orphan child
        const orphanNode = {
            templateObject: reelProxy,
            children: []
        };
        // let's add it to the root with the template-less nodes
        root.children.unshift(orphanNode);
    }

    private _addNodeToTree(reelProxy: ReelProxy, insertionMap: WeakMap<object, any>,
                   parentReelProxy: ReelProxy) {
        // add the node to the tree
        const node = {
            templateObject: reelProxy,
            expanded: this._expanded(reelProxy),
            children: []
        };
        const parentNode = insertionMap.get(parentReelProxy);
        const nodePosition = this._buildTreeFindChildPosition(reelProxy, parentReelProxy);
        if (nodePosition >= parentNode.children.length) {
            parentNode.children.push(node);
        } else {
            parentNode.children.splice(nodePosition, 0, node);
        }
        insertionMap.set(reelProxy, node);
    }

    private _expanded(reelProxy: ReelProxy) {
        const toggleStates = this.templateObjectsTreeToggleStates;
        return (toggleStates.get(reelProxy) !== undefined) ? toggleStates.get(reelProxy) : true;
    }

    private _buildTreeFindChildPosition(reelProxy: ReelProxy, parentReelProxy: ReelProxy) {
        let node = reelProxy.properties.get("element");
        const parentNode = parentReelProxy.properties.get("element");
        let nodePosition;
        // the parentReelProxy does not have to be the direct parentNode
        while (node.parentNode && (node.parentNode !== parentNode)) {
            node = node.parentNode;
        }
        nodePosition = parentNode.children.indexOf(node);
        if (nodePosition === -1) {
            throw new Error("Can not find child position");
        }
        return nodePosition;
    }

    private _addNodeWithoutDOM(reelProxy: ReelProxy, root) {
        // has not DOM representation, added as root children
        const nodeTemplateLess = {
            templateObject: reelProxy,
            children: []
        };
        // let's add them in top to keep the tree "cleaner"
        root.children.unshift(nodeTemplateLess);
    }

    private get _ownerBlueprint() {
        if (!this.__ownerBlueprint) {
            const packageRequire = this._packageRequire;

            // Before we can actually edit the ownerBlueprint, we need other types of blueprint
            // from the same package
            this.__ownerBlueprint = Promise.all([
                packageRequire.async("montage/core/meta/property-descriptor").get("PropertyDescriptor"),
                packageRequire.async("montage/core/meta/event-descriptor").get("EventDescriptor"),
                packageRequire.async(this._moduleId).get(this._exportName).get("blueprint")
            ]).then(([propertyBlueprint, eventBlueprint, ownerBlueprint]) => {
                this._propertyBlueprintConstructor = propertyBlueprint;
                this._eventBlueprintConstructor = eventBlueprint;
                return ownerBlueprint;
            });
        }

        return this.__ownerBlueprint;
    }

    // Files

    private get _jsFileUrl() {
        const filenameMatch = this._url.match(/.+\/(.+)\.reel/);
        return this._url + filenameMatch[1] + ".js";
    }

    /**
     * Registers a new file to save when the document is saved.
     *
     * @param  {string}   extension The extension of the file.
     * @param  {function(location, dataSource): Promise} saveCallback
     * A function to call to save the file. Passed the location of the file
     * created by taking the reel location, extracting the basename and
     * suffixing the extensions. Must return a promise for the saving of the
     * file.
     */
    registerFile(extension: string,
                 saveCallback: (location: string, dataSource: any) => Promise<any>,
                 thisArg) {
        this._registeredFiles[extension] = {callback: saveCallback, thisArg: thisArg};
    }

    private _generateHtml() {
        this._buildSerializationObjects();
        return new TemplateFormatter(this._template).getHtml();
    }

    private _saveHtml(location, dataSource) {
        var self = this;
        var html;

        if (!this.hasModifiedData(location)) {
            return;
        }

        html = this._generateHtml();

        this._ignoreDataChange = true;
        return dataSource.write(location, html)
            .then(() => this._ignoreDataChange = false);
    }

    private _saveJs(location, dataSource) {
        var self = this;

        if (!this.hasModifiedData(location)) {
            return;
        }

        this._ignoreDataChange = true;
        return dataSource.write(location, this._javascript)
        .then(() => this._ignoreDataChange = false);
    }

    private _saveMeta(location, dataSource) {
        var serializer = new MontageSerializer().initWithRequire(this._packageRequire);
        return this._ownerBlueprint
            .then(function (blueprint) {
                var serializedDescription = serializer.serializeObject(blueprint);
                return dataSource.write(location, serializedDescription);
            });
    }

    private _getHtmlFileUrl() {
        var filenameMatch = this._url.match(/.+\/(.+)\.reel/);
        return this._url + filenameMatch[1] + ".html";
    }

    private _getJsFileUrl() {
        var filenameMatch = this._url.match(/.+\/(.+)\.reel/);
        return this._url + filenameMatch[1] + ".js";
    }

    hasModifiedData(url) {
        // const undoManager = this._undoManager;
        const undoManager = null;
        const hasModifiedData = this._hasModifiedData;
        if (url === this._getHtmlFileUrl()) {
            return undoManager && hasModifiedData &&
                (hasModifiedData.undoCount !== undoManager.undoCount ||
                hasModifiedData.redoCount !== undoManager.redoCount);
        } else if (url === this._getJsFileUrl()) {
            return this._isJavascriptModified && undoManager &&
                hasModifiedData &&
                (hasModifiedData.undoCount !== undoManager.undoCount ||
                hasModifiedData.redoCount !== undoManager.redoCount);
        }
    }

    private _resetModifiedDataState() {
        if (!this._hasModifiedData) {
            this._hasModifiedData = {undoCount: 0, redoCount: 0};
        }
        // this._hasModifiedData.undoCount = this._undoManager.undoCount;
        // this._hasModifiedData.redoCount = this._undoManager.redoCount;
        this._isJavascriptModified = false;
    }
}