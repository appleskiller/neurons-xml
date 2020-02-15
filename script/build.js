
var fs = require('fs-extra');
var path = require('path');
var util = require('./util');

var rollup = require('rollup');
var resolve = require('rollup-plugin-node-resolve');
var commonjs = require('rollup-plugin-commonjs');
var builtinsPlugin = require('rollup-plugin-node-builtins');
var globalsPlugin = require('rollup-plugin-node-globals');
var json = require('rollup-plugin-json');
var uglify = require('rollup-plugin-uglify').uglify;
var package = require('../package.json');

// auto name out file
const name = (package.name.charAt(0) === '@') ? package.name.slice(1).replace('/', '-') : package.name.replace('/', '-');
// auto name amd id
const amdId = package.name;
// intro
const intro = `var globalContext = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined') ? global : {};
if (!globalContext['${amdId}']) { globalContext['${amdId}'] = exports; }`;
// input
const inputFile = 'src/index.ts';
const buildins = {}
// external module
const external = [];
// external globals module for browser
const globals = {}
// use package.dependencies and package.peerDependencies as default externals and golbal ids
if (package.dependencies) { for (const key in package.dependencies) { !buildins[key] && external.push(key); !globals[key] && (globals[key] = key); } }
if (package.peerDependencies) { for (const key in package.peerDependencies) { !buildins[key] && external.push(key); !globals[key] && (globals[key] = key); } }
// ------------------------------------------------
// clear dist
// ================================================

fs.removeSync(path.resolve(__dirname, '../dist'));
console.log(`Clear dist ...`);

// ------------------------------------------------
// method & variables
// ================================================
// input base name
const inputBaseName = path.basename(inputFile, '.ts');
const compliedInputFile = `dist/${inputBaseName}.js`;
async function build(input, output) {
    // create a bundle
    const bundle = await rollup.rollup(input);
    // generate code and a sourcemap
    await bundle.generate(output);
    // or write the bundle to disk
    await bundle.write(output);
}
const baseInputOption = {
    input: compliedInputFile,
    plugins: [
        // htmlparser2 需要导出一些内建包例如events、string_decoder等
        globalsPlugin(),
        builtinsPlugin(),
        resolve({
            browser: true
        }),
        commonjs(),
        json()
    ]
}

// ------------------------------------------------
// complie typescript
// ================================================

util.exec(`tsc -p tsconfig.json -d --declarationDir dist --outDir dist`);
package.typings = `${inputBaseName}.d.ts`;
package.main = `${inputBaseName}.js`;

async function buildAll() {
    // ------------------------------------------------
    // UMD Module uglify bundle -> package.main
    // ================================================
    await build({
        ...baseInputOption,
        plugins: [
            ...baseInputOption.plugins,
            uglify()
        ],
        external: external,
    }, {
        name: amdId,
        file: `dist/umd/${name}.min.js`,
        format: 'umd',
        exports: 'named',
        globals: globals,
        intro: intro
    });
    console.log(`${inputFile} -> dist/umd/${name}.min.js ...`);
    // update package
    // package.main = `umd/${name}.min.js`;
    // ------------------------------------------------
    // write package.json and copy files
    // ================================================
    fs.outputJsonSync(path.resolve(__dirname, '../dist/package.json') , package, { spaces: '  ' });
    if (fs.existsSync(path.resolve(__dirname, '../LICENSE'))) {
        fs.copySync(path.resolve(__dirname, '../LICENSE'), path.resolve(__dirname, '../dist/LICENSE'));
    }
    if (fs.existsSync(path.resolve(__dirname, '../README.md'))) {
        fs.copySync(path.resolve(__dirname, '../README.md'), path.resolve(__dirname, '../dist/README.md'));
    }
    console.log(`Copy package.json, LICENSE, README.md ...`);
    // ------------------------------------------------
    // done
    // ================================================
    console.log(`Done !`);
}

buildAll();
