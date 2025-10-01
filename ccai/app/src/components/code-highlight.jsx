import {createElement, memo, useMemo} from 'react';
import hljs from 'highlight.js';
import {parseDom} from './dom-parser';

hljs.configure({
    languages: [
        'plaintext',
        'markdown',
        'shell',
        'python',
        'json',
        'javascript',
        'typescript',
        'java',
        'csharp',
        'cpp',
    ]
});

const parser = new DOMParser();
const languageRegex = /\blang(?:uage)?-([\w-]+)\b/i;

export const CodeHighlight = memo(({content, className}) => {
    if (typeof content !== 'string') return;
    const language = useMemo(() => {
        const match = languageRegex.exec(className);
        if (match) {
            if (hljs.getLanguage(match[1])) return match[1];
            else return 'no-highlight';
        } else {
            return null;
        }
    }, [className]);
    const result = language ? hljs.highlight(content, {language, ignoreIllegals: true}) : hljs.highlightAuto(content);
    const doc = parser.parseFromString(result.value, 'text/html');
    const elements = Array.from(doc.body.childNodes).map((node, i) => parseDom(node, i));
    return createElement('code', {className: className}, ...elements);
});
