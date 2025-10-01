import {memo, createElement} from 'react';
import Convert from 'ansi-to-html';

export const convert = new Convert({
    escapeXML: true,
    newline: true,
    colors: {
        0: '#000000FF',
        1: '#CD3131FF',
        2: '#0DBC79FF',
        3: '#E5E510FF',
        4: '#2472C8FF',
        5: '#BC3FBCFF',
        6: '#11A8CDFF',
        7: '#E5E5E5FF',
        8: '#666666FF',
        9: '#F14C4CFF',
        10: '#23D18BFF',
        11: '#F5F543FF',
        12: '#3B8EEAFF',
        13: '#D670D6FF',
        14: '#29B8DBFF',
        15: '#FFFFFFFF'
    }
});

export const domToReact = (node, index = 0) => {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const props = {key: index};
        Array.from(node.attributes).forEach((attr) => {
            if (attr.name === 'class') {
                props['className'] = attr.value;
            } else if (attr.name === 'style') {
                const styleObj = {};
                attr.value.split(';').forEach(rule => {
                    const [property, value] = rule.split(':').map(s => s.trim());
                    if (property && value) {
                        // kebab-case to camelCase
                        const camelProp = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                        styleObj[camelProp] = value;
                    }
                });
                props['style'] = styleObj;
            } else {
                props[attr.name] = attr.value;
            }
        });
        const children = Array.from(node.childNodes).map((child, i) => domToReact(child, i));
        return createElement(tag, props, ...children);
    }
    return null;
};

export const Ansi = memo(({content, className}) => {
    if (typeof content !== 'string') return;
    const html = convert.toHtml(content);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = Array.from(doc.body.childNodes).map((node, i) => domToReact(node, i));
    return createElement('div', {className: ['ansi', className].filter(Boolean).join(' ')}, ...elements);
});
