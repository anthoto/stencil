/**
 * Build Web:
 * First build the core files for specifically ionic-web, and
 * create manifest.json with all meta data about each component.
 *
 * Bundle up all of the compiled ionic components, using the
 * newly created manifest.json as a guide, and create a bunch of
 * bundled js files which include each component.
 *
 * It'll also create "ionic.js", which is the base "loader" file
 * that decides which core file/polyfills it needs. The ionic-angular
 * project doesn't need a "loader" because it's built within
 * the initial ionic providers during bootstrap.
 */


const DEV_MODE = false;

const BUNDLES = [
  ['ion-app', 'ion-content', 'ion-navbar', 'ion-toolbar', 'ion-title'],
  ['ion-avatar', 'ion-thumbnail'],
  ['ion-badge'],
  ['ion-button'],
  ['ion-card', 'ion-card-content', 'ion-card-header', 'ion-card-title'],
  ['ion-list', 'ion-item', 'ion-label'],
  ['ion-list-header', 'item-divider'],
  ['ion-gesture', 'ion-scroll'],
  ['ion-toggle'],
  ['ion-slides', 'ion-slide'],
];


import { buildBindingCore, LICENSE, readFile, writeFile } from './build-core';
import * as cleanCss from 'clean-css';
import * as fs from 'fs-extra';
import * as nodeSass from 'node-sass';
import * as path from 'path';
import * as rollup from 'rollup';
import * as typescript from 'typescript';
import * as uglify from 'uglify-js';


// dynamic require cuz this file gets transpiled to dist/
const compiler = require(path.join(__dirname, '../compiler'));

const srcDir = path.join(__dirname, '../../src');
const transpiledSrcDir = path.join(__dirname, '../transpiled-web/bindings/web/src');
const compiledDir = path.join(__dirname, '../compiled-ionic-web');
const destDir = path.join(__dirname, '../ionic-web');

// first clean out the ionic-web directories
fs.emptyDirSync(destDir);
fs.emptyDirSync(compiledDir);


Promise.resolve().then(() => {
  // find all the source components and compile
  // them into reusable components, and create a manifest.json
  // where all the components can be found, and their styles.
  return compileComponents();

}).then(() => {
  // build all of the core files for ionic-web
  // the core files are what makes up how ionic-core "works"
  return buildBindingCore(transpiledSrcDir, compiledDir, 'core')

}).then(() => {
  // bundle all of the components into their separate files
  return bundleComponents().then(results => {

    // build the ionic.js loader file which
    // ionic-web uses to decide which core files to load
    // then prepend the component registry to the top of the loader file
    return buildWebLoader(results.componentRegistry, DEV_MODE);
  });
});


const ctx = {};

function compileComponents() {
  const config = {
    compilerOptions: {
      outDir: compiledDir,
      module: 'commonjs',
      target: 'es5'
    },
    include: [srcDir],
    exclude: ['node_modules', 'compiler', 'test'],
    devMode: DEV_MODE,
    debug: true,
    bundles: BUNDLES,
    packages: {
      fs: fs,
      path: path,
      nodeSass: nodeSass,
      rollup: rollup,
      typescript: typescript
    }
  };

  return compiler.compile(config, ctx);
}


function bundleComponents() {
  const config = {
    srcDir: compiledDir,
    destDir: destDir,
    packages: {
      cleanCss: cleanCss,
      fs: fs,
      path: path,
      rollup: rollup,
      uglify: uglify,
      nodeSass: nodeSass,
      typescript: typescript
    },
    devMode: DEV_MODE,
    debug: true
  };

  return compiler.bundle(config, ctx);
}


function buildWebLoader(componentRegistry: string, devMode: boolean) {
  console.log('buildWebLoader');

  const loaderSrcPath = path.join(transpiledSrcDir, 'ionic.js');
  const loaderDestPath = path.join(destDir, 'ionic.js');

  return readFile(loaderSrcPath).then(srcLoaderJs => {
    componentRegistry = `(window.Ionic=window.Ionic||{}).components=${componentRegistry};`;

    if (devMode) {
      const content = [
        LICENSE,
        componentRegistry,
        srcLoaderJs
      ].join('\n');

      return writeFile(loaderDestPath, content);
    }

    return writeFile(loaderDestPath, srcLoaderJs).then(() => {
      const ClosureCompiler = require('google-closure-compiler').compiler;

      return new Promise((resolve, reject) => {
        const opts = {
          js: loaderDestPath,
          language_out: 'ECMASCRIPT5',
          warning_level: 'QUIET',
          rewrite_polyfills: 'false',
          // formatting: 'PRETTY_PRINT',
          // debug: 'true'
        };

        var closureCompiler = new ClosureCompiler(opts);

        closureCompiler.run((exitCode: number, stdOut: string, stdErr: string) => {
          if (stdErr) {
            console.log('buildLoader closureCompiler, exitCode', exitCode, 'stdErr', stdErr);
            reject();

          } else {
            const content = [
              LICENSE,
              componentRegistry,
              stdOut
            ].join('\n');

            writeFile(loaderDestPath, content).then(() => {
              resolve();
            });
          }
        });
      });
    });
  });
}
