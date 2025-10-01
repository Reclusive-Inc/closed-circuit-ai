import {memo, createElement} from 'react';
import MarkdownIt from 'markdown-it';
import {parseDom} from './dom-parser';
import {CodeHighlight} from './code-highlight';

const md = new MarkdownIt({breaks: true});
const parser = new DOMParser();
const components = {
    'code': CodeHighlight
};

export const Markdown = memo(({content, className}) => {
    if (typeof content !== 'string') return;
    const html = md.render(content);
    const doc = parser.parseFromString(html, 'text/html');
    const elements = Array.from(doc.body.childNodes).map((node, i) => parseDom(node, i, components));
    return createElement('div', {className: ['markdown', className].filter(Boolean).join(' ')}, ...elements);
});
