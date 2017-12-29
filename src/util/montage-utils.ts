'use strict';

const locationDescCache = {};
const findObjectNameRegExp = /([^\/]+?)(\.reel)?$/;
const toCamelCaseRegExp = /(?:^|-)([^-])/g;

function replaceToCamelCase(_, g1: string) {
    return g1.toUpperCase();
}

export function parseObjectLocationId(locationId: string) {
    let locationDesc: {moduleId: string, objectName: string};

    if (locationId in locationDescCache) {
        locationDesc = locationDescCache[locationId];
    } else {
        const bracketIndex = locationId.indexOf("[");
        let moduleId: string;
        let objectName: string;

        if (bracketIndex > 0) {
            moduleId = locationId.substr(0, bracketIndex);
            objectName = locationId.slice(bracketIndex + 1, -1);
        } else {
            moduleId = locationId;
            findObjectNameRegExp.test(locationId);
            objectName = RegExp.$1.replace(
                toCamelCaseRegExp,
                replaceToCamelCase
            );
        }

        locationDesc = {
            moduleId: moduleId,
            objectName: objectName
        };
        locationDescCache[locationId] = locationDesc;
    }

    return locationDesc;
}