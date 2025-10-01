import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssNested from 'postcss-nested';

// version
const fontsVersion = 'v1';
const cssVersion = 'v1';
const jsVersion = 'v1';

// files
const fontsCssFileName = `fonts.${fontsVersion}.min.css`;
const ccaiCssFileName = `ccai.${cssVersion}.min.css`;
const jsFileName = `ccai.${jsVersion}.min.js`;

// ensure ./static exists
const outputDir = './';
const outputStaticDir = path.join(outputDir, 'static');
fs.mkdirSync(outputStaticDir, {recursive: true});

// ensure ./static/ccai exists
const ccaiStaticDir = path.join(outputStaticDir, 'ccai');
fs.mkdirSync(ccaiStaticDir, {recursive: true});

// esbuild
await esbuild.build({
    bundle: true,
    format: 'esm',
    platform: 'browser',
    treeShaking: false,
    minify: false,
    entryPoints: ['./src/ccai.jsx'],
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
    outfile: path.join(ccaiStaticDir, jsFileName),
});

// build ccai.css using postcss
const ccaiCssInput = fs.readFileSync('./src/ccai.css', 'utf8');
const ccaiCssResult = await postcss([postcssImport, postcssNested]).process(ccaiCssInput, {from: './src/ccai.css'});
fs.writeFileSync(path.join(ccaiStaticDir, ccaiCssFileName), ccaiCssResult.css);

// build fonts.css using postcss
const fontsCssInput = fs.readFileSync('./src/fonts.css', 'utf8');
const fontsCssResult = await postcss([postcssImport, postcssNested]).process(fontsCssInput, {from: './src/fonts.css'});
fs.writeFileSync(path.join(ccaiStaticDir, fontsCssFileName), fontsCssResult.css);

// update index.html
let indexHtml = fs.readFileSync('./index.html', 'utf8');
indexHtml = indexHtml.replace(/ccai\.v\d+\.min\.css/g, ccaiCssFileName);
indexHtml = indexHtml.replace(/fonts\.v\d+\.min\.css/g, fontsCssFileName);
indexHtml = indexHtml.replace(/ccai\.v\d+\.min\.js/g, jsFileName);
fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);

// update notebook.html
let notebookHtml = fs.readFileSync('./notebook.html', 'utf8');
notebookHtml = notebookHtml.replace(/ccai\.v\d+\.min\.css/g, ccaiCssFileName);
notebookHtml = notebookHtml.replace(/fonts\.v\d+\.min\.css/g, fontsCssFileName);
notebookHtml = notebookHtml.replace(/ccai\.v\d+\.min\.js/g, jsFileName);
fs.writeFileSync(path.join(outputDir, 'notebook.html'), notebookHtml);

console.log('build complete.');
console.log(`- ${jsFileName}`);
console.log(`- ${ccaiCssFileName}`);
console.log(`- ${fontsCssFileName}`);
