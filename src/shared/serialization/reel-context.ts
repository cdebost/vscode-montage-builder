import { ProxyContext } from '../../../montage-app/node_modules/palette/core/serialization/deserializer/proxy-context';

export const ReelContext = ProxyContext.specialize({

    getElementById: {
        value: function (id) {
            return this.editingDocument.nodeProxyForMontageId(id);
        }
    }
});
