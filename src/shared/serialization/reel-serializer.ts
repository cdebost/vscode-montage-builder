import { ReelVisitor } from './reel-visitor';
import { ProxySerializer } from '../../../montage-app/node_modules/palette/core/serialization/serializer/proxy-serializer';

export const ReelSerializer = ProxySerializer.specialize({

    visitorConstructor: {
        value: ReelVisitor
    }

});
