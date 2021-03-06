var ProxyVisitor = require("palette/core/serialization/serializer/proxy-visitor").ProxyVisitor;
var BUILDER_UNIT_LABEL = "_dev";

exports.ReelVisitor = ProxyVisitor.specialize({

    constructor: {
        value: function ReelVisitor() {
            this.super();
        }
    },


    visitNodeProxy: {
        value: function (malker, nodeProxy, name) {
            malker.visit(nodeProxy._templateNode, name);
        }
    },

    setObjectCustomUnits: {
        value: function(malker, object) {
            this.super(malker, object);

            var self = this,
                keys = object.originalSerializationMap.keys(),
                key;

            while (key = keys.next().value) {
                if (key !== "object" && key !== "prototype" && key !== "properties" && !self._units[key]) {
                    self.setObjectCustomUnit(malker, object, key);
                }
            }
        }
    },

    setObjectCustomUnit: {
        value: function (malker, object, unitName) {
            var value;

            if ("bindings" === unitName) {
                value = this.serializeBindingProxies(object.bindings);

            } else if ("listeners" === unitName) {
                value = this.serializeListenerProxies(object.listeners);
            } else {
                // Preserve whatever "units" were found in the serialization
                // even if we don't have any understanding of them
                value = object.originalSerializationMap.get(unitName);
            }

            if (value != null) {
                malker.visit(value, unitName);
            }
        }
    },

    serializeProxyObject: {
        value: function (malker, proxyObject, builderObject) {

            this.super(malker, proxyObject, builderObject);

            if (proxyObject.isUserObject) {
                builderObject.clearProperty("prototype");
                builderObject.clearProperty("object");
            }

            var metadataProperties = proxyObject.editorMetadata,
                metadataPropertyEntries = metadataProperties.entries(),
                metadataPropertyEntry;

            if (metadataProperties.size > 0) {
                var metadataSerializationObject = {};

                while (metadataPropertyEntry = metadataPropertyEntries.next().value) {
                    metadataSerializationObject[metadataPropertyEntry[0]] = metadataPropertyEntry[1];
                }

                builderObject.setProperty(BUILDER_UNIT_LABEL, metadataSerializationObject);
            } else {
                builderObject.clearProperty(BUILDER_UNIT_LABEL);
            }


        }
    },

    serializeListenerProxies: {
        value: function (listeners) {
            var outputs = [];
            var hasListeners;

            listeners.forEach(function (value) {
                var output = {};
                output.type = value.type;
                output.useCapture = value.useCapture;
                output.listener = {"@": value.listener.label};

                outputs.push(output);
                hasListeners = true;
            });

            return hasListeners ? outputs : undefined;
        }
    },

    serializeBindingProxies: {
        value: function (bindings) {
            var outputs = {};
            var hasBindings;

            bindings.forEach(function (binding) {
                var output = {};
                var sourcePath = binding.sourcePath;
                var converter = binding.converter;

                if (!binding.oneway) {
                    output["<->"] = sourcePath;
                } else {
                    output["<-"] = sourcePath;
                }

                if (converter) {
                    output.converter = {
                        "@": converter.label
                    };
                }

                if (binding.trace) {
                    output.trace = true;
                }

                outputs[binding.key] = output;
                hasBindings = true;
            });

            return hasBindings ? outputs : undefined;
        }
    }

});
