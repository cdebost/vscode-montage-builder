import { ReelDocument } from '../../shared/reel-document';
import { documentDataSourceMock } from './document-data-source.mock';
import { JSDOM } from 'jsdom';

//TODO this could be brought inline with the rest of the "mocking system"
export function mockReelDocument(fileUrl, serialization, bodyMarkup) {
    const mockDocument = new JSDOM().window.document;

    const serializationNode = mockDocument.createElement("script");
    serializationNode.setAttribute("type", "text/montage-serialization");
    serializationNode.innerHTML = JSON.stringify(serialization);
    mockDocument.getElementsByTagName("head")[0].appendChild(serializationNode);

    mockDocument.getElementsByTagName("body")[0].innerHTML = bodyMarkup;

    //TODO insert bodyMarkup
    const dataSource = documentDataSourceMock({
        read(url) {
            let content;

            if (/\.js$/.test(url)) {
                content = "";
            } else {
                content = mockDocument.documentElement.outerHTML;
            }
            return Promise.resolve(content);
        },
        write() {
            return Promise.resolve();
        }
    });

    fileUrl = require.location + fileUrl;
    var rd = new ReelDocument(fileUrl, dataSource, require);
    return rd.load()
    .then((reelDocument) => {
        // Mini mock for ui/component-editor/document-editor.reel
        // use _editor to avoid setter
        reelDocument._editor = {
            refresh: function () {}
        };
        return reelDocument;
    });
};

export class ReelDocMock {
    public url = "$reelDocumentUrl";
    private _packageRequire;

    get packageRequire() {
        if (!this._packageRequire) {
            this._packageRequire = {location: "$package-location$"};
        }
        return this._packageRequire;
    }
}

export function reelDocumentMock(options?: {}) {
    const doc = new ReelDocMock();

    if (options) {
        Object.keys(options).forEach((key) => {
            doc[key] = options[key];
        });
    }

    return doc;
}
