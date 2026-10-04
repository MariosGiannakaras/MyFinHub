import { spawnSync } from 'node:child_process';

const auditArgs=['audit','--audit-level=high','--json'];
const npmCli=process.env.npm_execpath;
const command=npmCli?process.execPath:(process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'npm');
const args=npmCli?[npmCli,...auditArgs]:(process.platform==='win32'?['/d','/s','/c','npm audit --audit-level=high --json']:auditArgs);
const result=spawnSync(command,args,{encoding:'utf8',shell:false});
const raw=(result.stdout||'').trim();
if(!raw){
  process.stderr.write(result.stderr||'npm audit produced no JSON output.\n');
  process.exit(result.status??1);
}

let report;
try{report=JSON.parse(raw)}catch(error){
  process.stderr.write(result.stderr||'');
  process.stderr.write(`Unable to parse npm audit JSON: ${error instanceof Error?error.message:String(error)}\n`);
  process.exit(result.status??1);
}

const vulnerabilities=report.vulnerabilities??{};
const blockedSeverities=new Set(['high','critical']);
const allowedAdvisory='GHSA-ch52-4w7c-c8xp';
const allowedPackages=new Set([
  'http-cache-semantics',
  'cacheable-request',
  'got',
  '@electron/get',
  'app-builder-lib',
  'dmg-builder',
  'electron-builder-squirrel-windows',
  'electron-builder',
]);

const viaIsAllowed=via=>{
  if(typeof via==='string')return allowedPackages.has(via);
  if(!via||typeof via!=='object')return true;
  if(!blockedSeverities.has(String(via.severity||'').toLowerCase()))return true;
  const fingerprint=`${via.url||''} ${via.title||''} ${via.source||''}`;
  return fingerprint.includes(allowedAdvisory);
};

const vulnerabilityIsAllowed=name=>{
  if(!allowedPackages.has(name))return false;
  const entry=vulnerabilities[name];
  if(!entry)return false;
  const highVia=(entry.via??[]).filter(via=>typeof via==='string'||blockedSeverities.has(String(via?.severity||'').toLowerCase()));
  return highVia.length>0&&highVia.every(viaIsAllowed);
};

const blocking=Object.entries(vulnerabilities)
  .filter(([,entry])=>blockedSeverities.has(String(entry?.severity||'').toLowerCase()))
  .filter(([name])=>!vulnerabilityIsAllowed(name));

if(blocking.length){
  process.stdout.write(raw+'\n');
  process.stderr.write(`Desktop dependency audit blocked by unexpected high/critical findings: ${blocking.map(([name])=>name).join(', ')}\n`);
  process.exit(1);
}

const allowed=Object.entries(vulnerabilities)
  .filter(([,entry])=>blockedSeverities.has(String(entry?.severity||'').toLowerCase()))
  .map(([name])=>name);

if(allowed.length){
  process.stdout.write(`Desktop dependency audit: temporarily allowing only ${allowedAdvisory} through the electron-builder build-time chain (${allowed.join(', ')}). Upstream currently has no patched http-cache-semantics release; any different high/critical advisory still fails this gate.\n`);
}else{
  process.stdout.write('Desktop dependency audit passed with no high/critical findings.\n');
}
