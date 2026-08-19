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
const generatedIcon=path.join(buildDir,'icon-512.png');
const major=Number(process.versions.node.split('.')[0]);

if(process.platform!=='win32')throw new Error('MyFinHub desktop packaging must run on Windows.');
if(major!==22)throw new Error(`MyFinHub local backend must be packaged with Node 22.x; found ${process.version}.`);
if(!fs.existsSync(distIndex))throw new Error('Frontend dist is missing. Run npm run build before preparing the desktop bundle.');
if(!fs.existsSync(sourceIcon))throw new Error('MyFinHub 512x512 source icon is missing.');

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
  target:'node22',
  sourcemap:false,
  minify:false,
  legalComments:'none',
  logLevel:'info',
});

const runtimeExe=path.join(runtimeDir,'node.exe');
fs.copyFileSync(process.execPath,runtimeExe);
fs.writeFileSync(path.join(runtimeDir,'runtime.json'),`${JSON.stringify({node:process.version,platform:process.platform,arch:process.arch},null,2)}\n`,'utf8');
fs.copyFileSync(sourceIcon,generatedIcon);

const stat=fs.statSync(runtimeExe);
if(stat.size<10_000_000)throw new Error('Copied Node runtime is unexpectedly small.');
if(!fs.existsSync(generatedIcon)||fs.statSync(generatedIcon).size<10_000)throw new Error('Canonical Windows icon is invalid or unexpectedly small.');
console.log(`MyFinHub desktop backend bundled with ${process.version} (${process.arch}); canonical 512x512 Windows icon staged.`);
