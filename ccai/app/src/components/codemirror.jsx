import {useLayoutEffect, useRef} from 'react';
import {yCollab} from 'y-codemirror.next';
import {Compartment, EditorState} from '@codemirror/state';
import {
    crosshairCursor,
    drawSelection,
    dropCursor,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    rectangularSelection
} from '@codemirror/view';
import {bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap, HighlightStyle, indentOnInput, syntaxHighlighting} from '@codemirror/language';
import {python} from '@codemirror/lang-python';
import {markdown} from "@codemirror/lang-markdown";
import {javascript} from "@codemirror/lang-javascript";
import {json} from "@codemirror/lang-json";
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
import {tags as t} from '@lezer/highlight';

export const codemirrorDark = () => {
    const theme = EditorView.theme(
        {
            '&': {
                backgroundColor: '#1E1F22',
                color: '#BCBEC4',
            },
            '.cm-gutters': {
                backgroundColor: 'rgba(50, 50, 50, 0.1)',
                color: '#4B5059',
                borderRightColor: 'transparent',
            },
            '.cm-content': {
                caretColor: '#CED0D6',
            },
            '.cm-cursor, .cm-dropCursor': {
                borderLeftColor: '#CED0D6',
            },
            '.cm-activeLine': {
                backgroundColor: 'rgba(100, 100, 100, 0.1)',
            },
            '.cm-activeLineGutter': {
                backgroundColor: 'rgba(100, 100, 100, 0.1)',
            },
            '&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection': {
                background: 'rgba(255, 255, 255, 0.1) !important',
            },
            '& .cm-selectionMatch': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
            '.cm-foldPlaceholder': {
                backgroundColor: '#BCBEC4',
                borderColor: '#BCBEC4',
            },
        },
        {dark: true}
    );

    const highlightStyle = HighlightStyle.define([
        {tag: [t.atom], color: '#C77DBB'},
        {tag: [t.number], color: '#2AACB8'},
        {tag: [t.comment], color: '#7A7E85'},
        {tag: [t.string], color: '#6AAB73'},
        {tag: [t.variableName], color: '#BCBEC4'},
        {tag: [t.operator], color: '#BCBEC4'},
        {tag: [t.meta], color: '#B3AE60'},
        {tag: [t.className], color: '#BCBEC4'},
        {tag: [t.propertyName], color: '#C77DBB'},
        {tag: [t.keyword], color: '#CF8E6D'},
        {tag: [t.tagName], color: '#D5B778'},
        {tag: [t.typeName], color: '#16BAAC'},
    ]);

    return [theme, syntaxHighlighting(highlightStyle)];
};

export const CodeMirror = ({yText, yUndoManager, awareness, language, theme, className, style, focus, onFocus, onBlur, onKeyDown}) => {
    const elementRef = useRef(null);
    const stateRef = useRef(null);
    const viewRef = useRef(null);
    const themeCompartmentRef = useRef(null);

    useLayoutEffect(() => {
        if (!yText || !yUndoManager || !awareness) return;

        const themeCompartment = new Compartment();
        themeCompartmentRef.current = themeCompartment;

        const extensions = [
            lineNumbers({
                formatNumber: (line) => {
                    return String(line).padStart(2, '\u00A0');
                },
            }),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
            bracketMatching(),
            closeBrackets(),
            autocompletion(),
            rectangularSelection(),
            crosshairCursor(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            keymap.of([
                indentWithTab,
                ...closeBracketsKeymap,
                ...defaultKeymap,
                ...searchKeymap,
                ...historyKeymap,
                ...foldKeymap,
                ...completionKeymap,
                ...lintKeymap
            ]),
            EditorView.updateListener.of((update) => {
                if (update.focusChanged && update.view.hasFocus && onFocus) onFocus(update);
                if (update.focusChanged && !update.view.hasFocus && onBlur) onBlur(update);
            }),
            EditorView.lineWrapping,
            yCollab(yText, awareness, {yUndoManager}),
            themeCompartment.of(theme === 'light' ? [] : codemirrorDark()),
        ];

        switch (language) {
            case 'python':
                extensions.push(python());
                break;
            case 'markdown':
                extensions.push(markdown());
                break;
            case 'javascript':
                extensions.push(javascript({jsx: true}));
                break;
            case 'json':
                extensions.push(json());
                break;
            default:
                break;
        }

        const state = EditorState.create({
            doc: yText.toString(),
            extensions: extensions,
        });
        stateRef.current = state;

        const view = new EditorView({state, parent: elementRef.current});
        viewRef.current = view;

        if (focus) {
            view.focus();
            view.dispatch({selection: {anchor: 0}});
        }

        return () => {
            view.destroy();
            viewRef.current = null;
            stateRef.current = null;
            themeCompartmentRef.current = null;
        };
    }, [yText, yUndoManager, awareness, language, theme, focus, onFocus, onBlur]);

    useLayoutEffect(() => {
        if (!stateRef.current || !viewRef.current || !themeCompartmentRef.current) return;
        viewRef.current.dispatch({
            effects: themeCompartmentRef.current.reconfigure(
                theme === 'light' ? [] : codemirrorDark()
            ),
        });
    }, [theme]);

    return (
        <div ref={elementRef} className={['cm-container', className].filter(Boolean).join(' ')} style={style} onKeyDown={onKeyDown}></div>
    );
};
