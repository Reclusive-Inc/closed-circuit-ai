import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssNested from 'postcss-nested';

// ensure ./static exists
const outputDir = './';
const outputStaticDir = path.join(outputDir, 'static');
fs.mkdirSync(outputStaticDir, {recursive: true});

// ensure ./static/chat exists
const chatStaticDir = path.join(outputStaticDir, 'chat');
fs.mkdirSync(chatStaticDir, {recursive: true});

// esbuild
const jsFileName = `chat.min.js`;
await esbuild.build({
    bundle: true,
    format: 'esm',
    platform: 'browser',
    treeShaking: false,
    minify: false,
    entryPoints: ['./src/chat.jsx'],
    loader: {
        '.jsx': 'jsx',
        '.js': 'jsx',
    },
    jsx: 'automatic',
    jsxImportSource: 'react',
    external: [
        'ccai',
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'radix-ui',
        '@radix-ui/react-icons',
        'uuid',
        'highlight.js',
        'markdown-it',
        'ansi-to-html',
        'yjs',
        'y-websocket',
        'y-indexeddb',
        'y-codemirror.next',
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@codemirror/lang-python',
        '@codemirror/lang-markdown',
        '@codemirror/lang-javascript',
        '@codemirror/lang-json',
        '@codemirror/lang-html',
        '@codemirror/lang-css',
        '@codemirror/commands',
        '@codemirror/search',
        '@codemirror/autocomplete',
        '@codemirror/lint',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
        '@lezer/python',
        '@lezer/markdown',
        '@lezer/javascript',
        '@lezer/json',
        '@lezer/html',
        '@lezer/css',
    ],
    write: true,
    outfile: path.join(chatStaticDir, jsFileName),
});

// build css using postcss
const chatCssFileName = `chat.min.css`;
const chatCssInput = fs.readFileSync('./src/chat.css', 'utf8');
const chatCssResult = await postcss([postcssImport, postcssNested]).process(chatCssInput, {from: './src/chat.css'});
fs.writeFileSync(path.join(chatStaticDir, chatCssFileName), chatCssResult.css);

console.log('build complete.');
console.log(`- ${jsFileName}`);
console.log(`- ${chatCssFileName}`);
