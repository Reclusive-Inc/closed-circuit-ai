import {createElement} from 'react';

export const parseDom = (node, index = 0, components = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const props = {key: index};
        Array.from(node.attributes).forEach((attr) => {
            if (attr.name === 'class') {
                props['className'] = attr.value;
            } else {
                props[attr.name] = attr.value;
            }
        });
        if (components[tag]) {
            return createElement(components[tag], {
                ...props,
                content: node.textContent
            });
        }
        const children = Array.from(node.childNodes).map((child, i) => parseDom(child, i, components));
        return createElement(tag, props, ...children);
    }
    return null;
};
