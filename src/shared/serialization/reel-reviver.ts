import { ReelProxy } from '../reel-proxy';
import { ProxyReviver } from '../../../montage-app/node_modules/palette/core/serialization/deserializer/proxy-reviver';

export const ReelReviver = ProxyReviver.specialize({

    rootObjectLabel: {
        value: "owner"
    },

    proxyConstructor: {
        value: ReelProxy
    },

    // We want to be forgiving if an element can't be found, so that the
    // user can add one later
    reviveElement: {
        value: function () {
            var el = ProxyReviver.prototype.reviveElement.apply(this, arguments);

            if (Promise.is(el) && el.isRejected()) {
                return void 0;
            }

            return el;
        }
    },

    _initProxy: {
        value: function (proxyObject, label, context, serialization) {

            var isUserObject = false,
                exportId;

            // The owner and application labels are special exceptions
            // for templates that belong to a live component; objects
            // for both labels will be provided/created without a need
            // to specify an extraneous prototype.
            // We capture the exportId only to properly indicate the type
            // of object in the course of editing
            if (this.rootObjectLabel === label) {
                isUserObject = true;
                exportId = context.ownerExportId;
            } else if ("application" === label){
                isUserObject = true;
                exportId = "montage/core/application";
            } else {
                exportId = serialization.prototype || serialization.object;
            }

            return proxyObject.init(label, serialization, exportId, context.editingDocument, isUserObject);
        }
    },


    reviveExternalObject: {
        value: function(value, context, label) {

            // application is a special user object that is accessible
            // at runtime to all components, if a reference to the application
            // as an external is present in the declaration, we need to
            // provide a proxy for that user object
            if ("application" === label) {
                return new ReelProxy().init("application", {}, "montage/core/application", context.editingDocument, true);
            } else {
                return this.super(value, context, label);
            }
        }
    },

    // Stop MontageReviver from didReviveObjects
    didReviveObjects: {
        value: function (objects, context) {
        }
    }
});
