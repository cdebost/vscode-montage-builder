'use strict';

import assert = require('assert');

import { EditingProxy } from '../../shared/editing-proxy';

describe("Editing Proxy Tests", function () {
    let proxy: EditingProxy,
        label: string,
        serialization: {},
        exportId: string,
        editingDocument;

    beforeEach(function () {
        exportId = "foo/bar/baz";
        label = "myObject";
        serialization = {
            prototype: exportId,
            properties: {}
        };
        editingDocument = {
            url: "palette/test",
            packageRequire: {
                location: "montage/core/promise"
            }
        }
        proxy = new EditingProxy(label, serialization, exportId, editingDocument);
    });

    describe("initialization", function () {
        it("should have the expected label", function () {
            assert.equal(proxy.label, label);
        });

        it("should have the expected editingDocument", function () {
            assert.equal(proxy.editingDocument, editingDocument);
        });

        it("should always initialize the next target to be the document", function() {
            assert.equal(proxy.nextTarget, editingDocument);
        });

        it("should properly extract the moduleId from the exportId string", function() {
            assert.equal(proxy.moduleId, exportId);
        });

        it("should generate the correct export name", function() {
            assert.equal(proxy.exportName, "Baz");
        });
    });

    describe("preserving the original serialization as a map", function () {
        beforeEach(function () {
            serialization = {
                prototype: exportId,
                properties: {},
                foo: "something",
                bar: {
                    baz: "more",
                    qux: ["a", "b", "c"]
                }
            };

            proxy = new EditingProxy(label, serialization, exportId, editingDocument);
        });

        it("must preserve top level properties", function () {
            assert.equal(proxy.originalSerializationMap.get('foo'), "something");
        });

        it("must preserve the entire tree of properties", function () {
            var barUnit = proxy.originalSerializationMap.get('bar');

            assert.equal(barUnit.baz, "more");
            assert.equal(JSON.stringify(barUnit.qux), JSON.stringify(["a", "b", "c"]));
        });
    });
});
