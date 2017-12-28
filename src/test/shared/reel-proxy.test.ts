import assert = require('assert');

import { ReelProxy } from '../../shared/reel-proxy';
import { reelDocumentMock } from '../mock/reel-document.mock';

describe('Reel Proxy Tests', () => {
    let exportId, label, serialization, editingDocument, proxy;

    beforeEach(() => {
        exportId = "foo/bar/baz";
        label = "myObject";
        serialization = {
            prototype: exportId,
            properties: {}
        };
        editingDocument = reelDocumentMock();

        proxy = new ReelProxy(label, serialization, exportId, editingDocument);
    });

    describe("initialization", () => {
        it("must reject conflicting serialization prototype and exportId arguments", () => {
            assert.throws(() => {
                new ReelProxy(label, serialization, "different/export-id");
            });
        });

        it("should have the specified exportId if the serialization did not specify one", () => {
            proxy = new ReelProxy(label, {properties: {label: "owner"}}, "specified/export-id");
            assert.equal(proxy.exportId, "specified/export-id");
        });

        it("should have the specified exportId if the serialization did specifed one", () => {
            proxy = new ReelProxy(label, {prototype: "specified/export-id", properties: {label: "foo"}});
            assert.equal(proxy.exportId, "specified/export-id");
        });

        it("should have the expected label", () => {
            assert.equal(proxy.label, label);
        });

        it("should have the expected exportId", () => {
            assert.equal(proxy.exportId, "foo/bar/baz");
        });

        it("should have the expected moduleId", () => {
            assert.equal(proxy.moduleId, "foo/bar/baz");
        });

        it("should have the expected exportName", () => {
            assert.equal(proxy.exportName, "Baz");
        });
    });

    describe("reporting the identifier", () => {
        it("should report its label as the identifier in lieu of an explicit identifier", () => {
            assert.equal(proxy.identifier, label);
        });

        it("should report its explicit identifier as its identifier", () => {
            serialization.properties.identifier = "fooIdentifier";
            proxy = new ReelProxy(label, serialization, exportId);

            assert.equal(proxy.identifier, "fooIdentifier");
        });
    });

    describe("listeners", () => {
        it("should correctly represent a listener", () => {
            const element = {};
            const listenerObject = {};
            const serialization = {
                "prototype": "ui/foo.reel",
                "properties": {
                    "element": element
                },
                "listeners": [
                    {
                        "type": "fooEvent",
                        "listener": listenerObject
                    }
                ]
            };

            proxy = new ReelProxy(label, serialization);
            const listenerEntry = proxy.listeners[0];

            assert(listenerEntry);
            assert.equal(listenerEntry.type, "fooEvent");
            assert.equal(listenerEntry.listener, listenerObject);
        });
    });

    describe("setting properties", () => {
        it("should read properties that were part of the original serialization", () => {
            serialization = {};
            proxy = new ReelProxy(label, serialization, "different/export-id");
            proxy.setObjectProperty("foo", 42);

            assert.equal(proxy.getObjectProperty("foo"), 42);
        });

        it("should read properties that were not part of the original serialization", () => {
            proxy.setObjectProperty("foo", 42);
            assert.equal(proxy.getObjectProperty("foo"), 42);
        });

        it("should remove the specified property when deleting that property", () => {
            serialization = {
                properties: {
                    foo: 42
                }
            };
            proxy = new ReelProxy(label, serialization, "different/export-id");
            proxy.deleteObjectProperty("foo", 42);

            assert(!proxy.getObjectProperty("foo"));
        });

        it("should set the identifier as expected", () => {
            proxy.identifier = "aNewIdentifier";
            assert.equal(proxy.identifier, "aNewIdentifier");
            assert.equal(proxy.getObjectProperty("identifier"), "aNewIdentifier");
        });
    });
});