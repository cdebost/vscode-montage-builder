'use strict';

import { Template } from '../../montage-app/node_modules/montage/core/template';
import { Node } from 'jsdom';

const SERIALIZATION_SCRIPT_TYPE = Template.prototype._SERIALIZATION_SCRIPT_TYPE;

export class TemplateFormatter {
    static NO_FORMATTING = {
        "PRE": true
    };

    private static _referenceRegExp = /\{\s*(\"[#@]\")\s*:\s*(\"[^\"]+\")\s*\}/g;
    private static _bindingRegExp = /\{\s*(\"(?:<-|<->)\")\s*:\s*(\"[^\"]+\"\s*(?:,\s*\"converter\"\s*:\s*\{\s*\"@\"\s*:\s*\"[^\"]+\"\s*\}\s*|,\s*\"deferred\"\s*:\s*(true|false)\s*)*)\}/g;
    
    private _indent = 4;
    private _indentString = '    ';
    public template: Template;

    get indent() {
        return this._indent;
    }
    set indent(value) {
        this._indent = value;

        this._indentString = '';
        for (var i = 0; i < value; i++) {
            this._indentString += ' ';
        }
    }

    get doctypeString() {
        const doctype = this.template.document.doctype;

        return "<!DOCTYPE " +
            doctype.name +
            (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
            (!doctype.publicId && doctype.systemId ? ' SYSTEM' : '') +
            (doctype.systemId ? ' "' + doctype.systemId + '"' : '') +
            '>';
    }

    constructor(template: Template, indent?: number) {
        this.template = template;
        if (indent) {
            this.indent = indent;
        }
    }

    getIndentSpace(depth: number): string {
        return new Array(depth).join(this._indentString);
    }

    private _bindingReplacer(_, g1, g2) {
        return "{" + g1 + ": " + g2.replace(/,\s*/, ", ")
            .replace(/\n\s*/, "") + "}";
    }

    formatSerialization(serialization: string, depth: number): string {
        const indentSpace = this.getIndentSpace(depth);
        return serialization
            // Format element and object references into a single line.
            .replace(TemplateFormatter._referenceRegExp, "{$1: $2}")
            // Format binding declarations into a single line.
            .replace(TemplateFormatter._bindingRegExp, this._bindingReplacer)
            // Indent.
            .replace(/^/gm, indentSpace);
    }

    getHtml(): string {
        const rootNode = this.template.document.documentElement;
        return this.doctypeString + "\n" + this.getNodeHtml(rootNode);
    }

    /**
     * HTML generation
     */
    getNodeHtml(node: Node, depth?: number): string {
        depth = depth || 0;

        if (node.nodeType === Node.ELEMENT_NODE) {
            // skip serialization
            if (!(
                node.tagName === "SCRIPT" &&
                node.type === SERIALIZATION_SCRIPT_TYPE
            )) {
                return this.getElementHtml(node, depth);
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            return this.getTextHtml(node, depth);
        } else if (node.nodeType === Node.COMMENT_NODE) {
            return this.getCommentHtml(node, depth);
        }

        return ""; // unknown node type
    }

    getElementHtml(node: Node, depth: number): string {
        const indentSpace = this.getIndentSpace(depth);
        const hasChildNodes = node.childNodes.length > 0;
        const tagName = node.tagName;
        let html = indentSpace;
        let serializationHtml;

        // Unable to perform this optimization on the HEAD because
        // the serialization needs to be added.
        if (!hasChildNodes && tagName !== "HEAD") {
            html += node.outerHTML;
        } else if (tagName in TemplateFormatter.NO_FORMATTING) {
            html += node.innerHTML;
        } else {
            html += this.getOpenTagHtml(node);
            if (hasChildNodes) {
                html += "\n" +
                        this.getNodeListHtml(node.childNodes, depth) +
                    "\n";
            }
            // Add the serialization script as the last element of the head.
            if (tagName === "HEAD") {
                serializationHtml = this.getSerializationHtml(depth + 1);
                if (serializationHtml) {
                    html += indentSpace + serializationHtml + "\n";
                }
            }
            html += indentSpace + this.getCloseTagHtml(node);
        }

        return html;
    }

    getTextHtml(node: Node, depth: number): string {
        const indentSpace = this.getIndentSpace(depth);

        // Trim the text.
        const text = node.nodeValue.replace(/^\s*|\s*$/g, "");
        if (text) {
            return indentSpace + text;
        } else {
            return "";
        }
    }

    getCommentHtml(node: Node, depth: number): string {
        const indentSpace = this.getIndentSpace(depth);
        return indentSpace + "<!--" + node.nodeValue + "-->";
    }

    getOpenTagHtml(node: Node): string {
        const tagName = node.tagName.toLowerCase();

        let html = "<" + tagName;
        if (node.attributes.length > 0) {
            html += " " + this.getAttributesHtml(node.attributes);
        }
        html += ">";

        return html;
    }

    getAttributesHtml(attributes: {}): string {
        var attributeList = [],
            nodeValue;

        for (var i = 0, attribute; attribute = attributes[i]; i++) {
            if (attribute.nodeValue) {
                nodeValue = attribute.nodeValue.replace("\"", "&quot;");
            } else {
                nodeValue = attribute.nodeValue;
            }
            attributeList.push(attribute.nodeName + '="' + nodeValue + '"');
        }

        return attributeList.join(" ");
    }

    getCloseTagHtml(node: Node): string {
        const tagName = node.tagName.toLowerCase();
        return "</" + tagName + ">";
    }

    getNodeListHtml(childNodes: Node[], depth: number): string {
        const htmlList = [];

        if (childNodes.length > 0) {
            for (var i = 0, childNode; childNode = childNodes[i]; i++) {
                const htmlItem = this.getNodeHtml(childNode, depth + 1);
                if (htmlItem) {
                    htmlList.push(htmlItem);
                }
            }
        }

        return htmlList.join("\n");
    }

    getSerializationHtml(depth: number): string {
        const serialization = this.template.objectsString;

        if (serialization) {
            const indentSpace = this.getIndentSpace(depth);
            return indentSpace +
                '<script type="' + SERIALIZATION_SCRIPT_TYPE + '">\n' +
                this.formatSerialization(serialization, depth) + "\n" +
                indentSpace + '</script>';
        } else {
            return "";
        }
    }
}