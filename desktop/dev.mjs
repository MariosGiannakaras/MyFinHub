import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const desktopDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(desktopDir,'..');
const npm=process.platform==='win32'?'npm.cmd':'npm';

function run(command,args,cwd,env=process.env){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,stdio:'inherit',windowsHide:false});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited with ${code??'unknown'}.`)));
  });
}

if(process.platform!=='win32')throw new Error('MyFinHub desktop development currently targets Windows.');
if(Number(process.versions.node.split('.')[0])!==22)throw new Error(`Use Node 22.x for MyFinHub desktop development; found ${process.version}.`);

const envFile=path.join(root,'.env');
if(fs.existsSync(envFile))process.loadEnvFile(envFile);
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY){
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in the environment or root .env file.');
}

await run(npm,['run','build'],root);
await run(process.execPath,[path.join(desktopDir,'prepare-build.mjs')],desktopDir);

const electronExe=path.join(desktopDir,'node_modules','electron','dist','electron.exe');
if(!fs.existsSync(electronExe))throw new Error('Electron is not installed. Run npm ci --prefix desktop.');

const env={...process.env,RHEOMIQ_DESKTOP_NODE:process.execPath};
delete env.SUPABASE_SECRET_KEY;
delete env.SUPABASE_SERVICE_ROLE_KEY;
await run(electronExe,['.'],desktopDir,env);
