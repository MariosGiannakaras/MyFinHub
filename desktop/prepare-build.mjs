import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const desktopDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(desktopDir,'..');
const buildDir=path.join(desktopDir,'.build');
const serverDir=path.join(buildDir,'server');
const runtimeDir=path.join(buildDir,'runtime');
const distIndex=path.join(root,'dist','index.html');
const sourceIcon=path.join(root,'public','brand','icon-512.png');
const sourceVector=path.join(root,'public','brand','icon-512.svg');
const major=Number(process.versions.node.split('.')[0]);

if(process.platform!=='win32')throw new Error('MyFinHub desktop packaging must run on Windows.');
if(major!==24)throw new Error(`MyFinHub local backend must be packaged with Node 24.x; found ${process.version}.`);
if(!fs.existsSync(distIndex))throw new Error('Frontend dist is missing. Run npm run build before preparing the desktop bundle.');
if(!fs.existsSync(sourceIcon))throw new Error('MyFinHub 512x512 Windows icon source is missing.');
if(!fs.existsSync(sourceVector))throw new Error('MyFinHub vector brand master is missing.');

fs.rmSync(buildDir,{recursive:true,force:true});
fs.mkdirSync(serverDir,{recursive:true});
fs.mkdirSync(runtimeDir,{recursive:true});

await build({
  absWorkingDir:root,
  entryPoints:['server/index.ts'],
  outfile:path.join(serverDir,'server.mjs'),
  bundle:true,
  platform:'node',
  format:'esm',
  target:'node24',
  // Express still contains CommonJS dependencies (for example debug -> require('tty')).
  // esbuild's ESM runtime helper can delegate dynamic requires to a real Node require when
  // one exists, so provide an ESM-safe createRequire bridge at the top of the bundle.
  banner:{js:"import { createRequire as __myfinhubCreateRequire } from 'node:module'; const require = __myfinhubCreateRequire(import.meta.url);"},
  sourcemap:false,
  minify:false,
  legalComments:'none',
  logLevel:'info',
});

const runtimeExe=path.join(runtimeDir,'node.exe');
fs.copyFileSync(process.execPath,runtimeExe);
fs.writeFileSync(path.join(runtimeDir,'runtime.json'),`${JSON.stringify({node:process.version,platform:process.platform,arch:process.arch},null,2)}\n`,'utf8');

const stat=fs.statSync(runtimeExe);
if(stat.size<10_000_000)throw new Error('Copied Node runtime is unexpectedly small.');
if(fs.statSync(sourceIcon).size<4_000)throw new Error('MyFinHub 512x512 Windows icon source is invalid.');
console.log(`MyFinHub desktop backend bundled with ${process.version} (${process.arch}); Windows packaging uses the reviewed 512x512 PNG export from the PureVector master.`);
