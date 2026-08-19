import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const desktopDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(desktopDir,'..');
const buildDir=path.join(desktopDir,'.build');
const serverDir=path.join(buildDir,'server');
const runtimeDir=path.join(buildDir,'runtime');
const distIndex=path.join(root,'dist','index.html');
const sourceIcon=path.join(root,'public','favicon.png');
const nativeAppIcon=path.join(root,'public','brand','icon-512.png');
const generatedIcon=path.join(buildDir,'icon-512.png');
const major=Number(process.versions.node.split('.')[0]);

if(process.platform!=='win32')throw new Error('MyFinHub desktop packaging must run on Windows.');
if(major!==22)throw new Error(`MyFinHub local backend must be packaged with Node 22.x; found ${process.version}.`);
if(!fs.existsSync(distIndex))throw new Error('Frontend dist is missing. Run npm run build before preparing the desktop bundle.');
if(!fs.existsSync(sourceIcon))throw new Error('MyFinHub verified favicon source is missing.');
if(!fs.existsSync(nativeAppIcon))throw new Error('MyFinHub native 512x512 Windows icon source is missing.');

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

const resizeScript=path.join(buildDir,'resize-icon.ps1');
fs.writeFileSync(resizeScript,`param([string]$Source,[string]$Destination)\nAdd-Type -AssemblyName System.Drawing\n$image=[Drawing.Image]::FromFile($Source)\ntry {\n  $bitmap=[Drawing.Bitmap]::new(512,512)\n  try {\n    $graphics=[Drawing.Graphics]::FromImage($bitmap)\n    try {\n      $graphics.Clear([Drawing.Color]::Transparent)\n      $graphics.CompositingQuality=[Drawing.Drawing2D.CompositingQuality]::HighQuality\n      $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic\n      $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::HighQuality\n      $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality\n      $graphics.DrawImage($image,0,0,512,512)\n    } finally { $graphics.Dispose() }\n    $bitmap.Save($Destination,[Drawing.Imaging.ImageFormat]::Png)\n  } finally { $bitmap.Dispose() }\n} finally { $image.Dispose() }\n`,'utf8');
try{
  execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resizeScript,'-Source',sourceIcon,'-Destination',generatedIcon],{stdio:'inherit'});
}finally{
  fs.rmSync(resizeScript,{force:true});
}

fs.copyFileSync(nativeAppIcon,generatedIcon);

const stat=fs.statSync(runtimeExe);
if(stat.size<10_000_000)throw new Error('Copied Node runtime is unexpectedly small.');
if(!fs.existsSync(generatedIcon)||fs.statSync(generatedIcon).size<4_000)throw new Error('Generated Windows icon is invalid.');
console.log(`MyFinHub desktop backend bundled with ${process.version} (${process.arch}); native 512x512 Windows icon prepared.`);
