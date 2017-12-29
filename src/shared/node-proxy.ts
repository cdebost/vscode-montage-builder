'use strict';

import { Node } from 'jsdom';

const MONTAGE_ID_ATTRIBUTE = "data-montage-id";
const MONTAGE_ARG_ATTRIBUTE = "data-arg";
const MONTAGE_PARAM_ATTRIBUTE = "data-param";

export class NodeProxy {
    public component;
    public isInTemplate = false;

    private _templateNode: Node;
    private _editingDocument;
    private parentNode: Node;
    private children: NodeProxy[];
    private _attributeToPropertyMap = {};

    constructor(node, editingDocument) {
        const attributeMap = this._attributeToPropertyMap;
        attributeMap[MONTAGE_ID_ATTRIBUTE] = "montageId";
        attributeMap[MONTAGE_ARG_ATTRIBUTE] = "montageArg";
        attributeMap[MONTAGE_PARAM_ATTRIBUTE] = "montageParam";

        this._templateNode = node;
        this._editingDocument = editingDocument;

        const children = this._templateNode.children;
        const childrenProxies = [];

        for (let i = 0, iChildNode; (iChildNode = children.item(i)); i++) {
            const childProxy = new NodeProxy(iChildNode, this._editingDocument);
            childrenProxies.push(childProxy);
            childProxy.parentNode = this;
        }

        this.children = childrenProxies;
    }

    destroy() {
        this._editingDocument = null;
        this.component = null;
    }

    get templateNode(): Node {
        return this._templateNode;
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }

        const parentsChildren = this.parentNode.children;
        const indexInParent = parentsChildren.indexOf(this);
        return parentsChildren[indexInParent + 1];
    }

    get lastChild() {
        let lastChild = null;

        if (this.children.length) {
            lastChild = this.children[this.children.length - 1];
        }

        return lastChild;
    }

    get tagName() {
        return this._templateNode ? this._templateNode.tagName : null;
    }
    set tagName(value) {
        const currentNode = this._templateNode;
        const doc = currentNode.ownerDocument;
        const parent = currentNode.parentNode;

        // Create new element
        const newNode = doc.createElement(value);
        // Copy attributes
        const attributes = currentNode.attributes;
        for (let i = 0, len = attributes.length; i < len; i++) {
            const attr = attributes[i];
            newNode.setAttribute(attr.name, attr.value);
        }
        // Move children
        const children = currentNode.childNodes;
        for (let i = 0, len = children.length; i < len; i++) {
            // The nodes are removed from the childNodes array as we append
            // them here, so the next node to add is always the first one
            newNode.appendChild(children[0]);
        }
        // Set correct parent on the children's nodeProxies

        parent.replaceChild(newNode, currentNode);
        this._templateNode = newNode;
    }

    get montageId(): string {
        return this.getAttribute(MONTAGE_ID_ATTRIBUTE);
    }
    set montageId(value: string) {
        this.setAttribute(MONTAGE_ID_ATTRIBUTE, value);
    }

    get montageArg(): string {
        return this.getAttribute(MONTAGE_ARG_ATTRIBUTE);
    }
    set montageArg(value: string) {
        this.setAttribute(MONTAGE_ARG_ATTRIBUTE, value);
    }

    get montageParam(): string {
        return this.getAttribute(MONTAGE_PARAM_ATTRIBUTE);
    }
    set montageParam(value: string) {
        this.setAttribute(MONTAGE_PARAM_ATTRIBUTE, value);
    }

    get className(): string {
        return this._templateNode.className;
    }

    getAttribute(attribute: string) {
        return this._templateNode ? this._templateNode.getAttribute(attribute) : null;
    }

    setAttribute(attribute: string, value) {
        var previousValue = this.getAttribute(attribute);

        if (previousValue === value) {
            return;
        }

        if (value) {
            this._templateNode.setAttribute(attribute, value);
        } else {
            this._templateNode.removeAttribute(attribute);
        }
    }

    get snippet(): string {
        let snippet = "";
        if (this._templateNode) {
            snippet = this._templateNode.outerHTML;
            if (this._templateNode.innerHTML.length) {
                var contentStart = snippet.indexOf(this._templateNode.innerHTML);
                snippet = snippet.substring(0, contentStart);
            }
        }
        return snippet;
    }

    //TODO make react to changes in underlying computed function…not sure how to do that without knowing underlying implementation
    get canRemoveNode() {
        return this._editingDocument.canRemoveTemplateNode(this);
    }

    get canAppendToNode() {
        return this._editingDocument.canAppendToTemplateNode(this);
    }

    get canInsertBeforeNode() {
        return this._editingDocument.canInsertBeforeTemplateNode(this);
    }

    get canInsertAfterNode() {
        return this._editingDocument.canInsertAfterTemplateNode(this);
    }

    appendChild(nodeProxy) {
        // HACK
        if (nodeProxy instanceof Node) {
            return;
        }

        //TODO make this guard against edgecases e.g. transplanting nodes
        //TODO not actually update the underlying DOM live on edits?
        this._templateNode.appendChild(nodeProxy._templateNode);
        this.children.push(nodeProxy);
        nodeProxy.parentNode = this;
    }

    removeChild(nodeProxy) {
        this._templateNode.removeChild(nodeProxy._templateNode);

        //TODO ensure child is actually a child
        var index = this.children.indexOf(nodeProxy);
        if (index >= 0) {
            this.children.splice(index, 1);
        }

        nodeProxy.parentNode = null;
        return nodeProxy;
    }

    insertBefore(nodeProxy, nextSiblingProxy) {
        if (nextSiblingProxy) {
            this._templateNode.insertBefore(nodeProxy._templateNode, nextSiblingProxy._templateNode);

            var index = this.children.indexOf(nextSiblingProxy);
            if (index >= 0) {
                this.children.splice(index, 0, nodeProxy);
            }

            nodeProxy.parentNode = this;
        } else {
            this.appendChild(nodeProxy);
        }

        return nodeProxy;
    }
}
