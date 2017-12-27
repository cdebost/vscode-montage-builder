'use strict';

import { Map } from 'collections/map';

export class EditingProxy {
    public label: string;
    protected _exportId: string;
    protected _editingDocument;
    private _originalSerializationMap;
    public properties: Map<string, any>;
    public bindings: any[];

    constructor(label: string, serialization, exportId: string, editingDocument) {
        this.label = label;
        this._exportId = exportId;
        this._editingDocument = editingDocument;
        this._populateWithSerialization(serialization);
    }

    protected _populateWithSerialization(serialization) {
        let serializationBindings = serialization.bindings || {};

        this._originalSerializationMap = Map.from(serialization);

        // We specifically surface the properties as a top level API
        this.properties = Map.from(serialization.properties);

        this.bindings = Object.keys(serializationBindings).map(key => {
            const bindingEntry = serialization.bindings[key];
            const bindingDescriptor = Object.create(null);

            bindingDescriptor.bound = true;
            bindingDescriptor.key = key;
            bindingDescriptor.oneway = ("<-" in bindingEntry);
            bindingDescriptor.sourcePath = bindingDescriptor.oneway ? bindingEntry["<-"] : bindingEntry["<->"];
            /* TODO the converter seems to be maintaining state */
            if (bindingEntry.converter) {
                bindingDescriptor.converter = bindingEntry.converter;
            }

            return bindingDescriptor;
        });
    }

    setObjectProperty(property: string, value) {
        this.properties.set(property, value);
    }

    getObjectProperty(property: string) {
        return this.properties.get(property);
    }

    deleteObjectProperty(property: string) {
        this.properties.delete(property);
    }

    setObjectProperties(values: {}) {
        for (let name in values) {
            if (values.hasOwnProperty(name)) {
                this.setObjectProperty(name, values[name]);
            }
        }
    }

    getObjectProperties(values: {}): {} {
        const result = {};
        let entries;
        let entry;

        if (values) {
            // We have a values object only returmn the required values
            for (let name in values) {
                if (values.hasOwnProperty(name)) {
                    result[name] = this.getObjectProperty(name);
                }
            }
        } else {
            // return all properties
            entries = this.properties.entries();

            while (entry = entries.next().value) {
                result[entry[0]] = entry[1];
            }
        }
        return result;
    }

    defineObjectBinding(key: string, oneway: boolean, sourcePath: string, converter) {
        var binding = this.getObjectBinding(key);

        if (binding) {
            binding.bound = true;
            binding.oneway = oneway;
            binding.sourcePath = sourcePath;
            binding.converter = converter;
        } else {
            binding = Object.create(null);
            binding.key = key;
            binding.bound = true;
            binding.oneway = oneway;
            binding.sourcePath = sourcePath;
            binding.converter = converter;
            this.bindings.push(binding);
        }

        return binding;
    }

    getObjectBinding(key: string) {
        return this.bindings.find(binding => binding.key === key);
    }

    cancelObjectBinding(key: string) {
        const bindingsLength = this.bindings.length;
        for (let i = 0; i < bindingsLength; ++i) {
            const binding = this.bindings[i];
            if (binding.key === key) {
                this.bindings.splice(i, 1);
                return binding;
            }
        }
    }
}