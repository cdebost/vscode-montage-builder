'use strict';

export class DocumentDataSource {
    read(): Promise<any> {
        return Promise.resolve();
    }

    registerDataModifier() {

    }

    unregisterDataModifier() {

    }

    addEventListener() {

    }

    removeEventListener() {

    }

    isModified() {

    }
}

export function documentDataSourceMock(options) {
    const documentDataSource = new DocumentDataSource();

    Object.keys(options || {}).forEach((key) => {
        documentDataSource[key] = options[key];
    });

    return documentDataSource;
};
