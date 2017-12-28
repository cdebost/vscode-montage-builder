'use strict';

import { EditingProxy } from './editing-proxy';
import { NodeProxy } from './node-proxy';
import { Map } from 'collections/map';

const BUILDER_UNIT_LABEL = '_dev';

export class ReelProxy extends EditingProxy {
    public listeners: any[];
    public editorMetadata;

    private _isUserObject: boolean = false;

    get identifier() {
        return this.properties.get('identifier') || this.label;
    }
    set identifier(value) {
        if (value !== this.identifier) {
            this.setObjectProperty('identifier', value);
        }
    }

    constructor(label: string, serialization, exportId?: string,
                editingDocument?, isUserObject: boolean = false) {
        super(label, serialization, exportId, editingDocument);
        if (!isUserObject && !exportId && !serialization.prototype && !serialization.object) {
            throw new Error("No exportId provided or found for template object with label '" + label + "'");
        }

        if (exportId && serialization.prototype && exportId !== serialization.prototype) {
            throw new Error("Conflicting serialization prototype and exportId values provided template object with label '" + label + "'");
        }

        if (serialization.object && serialization.prototype) {
            throw new Error("Serialization for object with label '" + label + "' cannot have both 'prototype' and 'object' attributes");
        }

        //TODO make sure that if the serialization specifically had no prototype, we don't go and write one in when saving
        this._exportId = exportId || serialization.prototype || serialization.object;
        this._isUserObject = isUserObject;

        this.properties.forEach((value, property) => {
            if (value instanceof NodeProxy) {
                editingDocument.references.add(value, this, property);
            }
        }, this);

        return this;
    }

    get isInTemplate() {
        return this._editingDocument.editingProxies.has(this);
    }

    getEditorMetadata(property: string) {
        return this.editorMetadata.get(property);
    }

    setEditorMetadata(property: string, value) {
        if (("comment" === property || "isHidden" === property) && !value) {
            this.editorMetadata.delete(property);
        } else {
            this.editorMetadata.set(property, value);
        }
    }

    protected _populateWithSerialization(serialization) {
        super._populateWithSerialization(serialization);

        let listeners = [];
        let listenerDescriptor;

        if (serialization.listeners) {
            listeners = serialization.listeners.map((listenerEntry) => {
                listenerDescriptor = Object.create(null);

                //TODO resolve the listener reference
                listenerDescriptor.listener = listenerEntry.listener;
                listenerDescriptor.type = listenerEntry.type;
                listenerDescriptor.useCapture = listenerEntry.useCapture;
                return listenerDescriptor;
            });
        }
        this.listeners = listeners;

        this.editorMetadata = Map.from(serialization[BUILDER_UNIT_LABEL]);
    }

    addEventListener(listener, insertionIndex: number) {
        const listenerIndex = this.listeners.indexOf(listener);

        if (-1 === listenerIndex) {
            if (isNaN(insertionIndex)) {
                this.listeners.push(listener);
            } else {
                this.listeners.splice(insertionIndex, 0, listener);
            }
        } else {
            //TODO guard against adding exact same listener to multiple proxies
            throw new Error("Cannot add the same listener to a proxy more than once");
        }

        return listener;
    }

    addObjectEventListener(type: string, listener, useCapture: boolean) {
        const listenerModel = Object.create(null);

        //TODO check for duplicate entry already registered

        listenerModel.type = type;
        listenerModel.listener = listener;
        listenerModel.useCapture = useCapture;

        this.listeners.push(listenerModel);

        return listenerModel;
    }

    updateObjectEventListener(listener, type: string, itsListener, useCapture: boolean) {
        const listenerIndex = this.listeners.indexOf(listener);
        let existinglistener;

        if (listenerIndex > -1) {
            existinglistener = listener;
        } else {
            throw new Error("Cannot update a listener that's not associated with this proxy.");
        }

        listener.type = type;
        listener.listener = itsListener;
        listener.useCapture = useCapture;

        return listener;
    }

    /**
     * Remove the specific listener from the set of active listeners on this proxy
     *
     * @return {Object} an object with two keys index and removedListener
     */
    removeObjectEventListener(listener): {} {
        const listenerIndex = this.listeners.indexOf(listener);

        if (listenerIndex > -1) {
            this.listeners.splice(listenerIndex, 1);
            return {index: listenerIndex, removedListener: listener};
        } else {
            throw new Error("Cannot remove a listener that's not associated with this proxy");
        }
    }
}