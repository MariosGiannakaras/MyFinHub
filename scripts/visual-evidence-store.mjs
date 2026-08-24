import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const repositoryRoot=process.cwd();
const versionMarker=resolve(repositoryRoot,'visual-qa/current-version.txt');
const gitValue=(...args)=>{try{return execFileSync('git',args,{encoding:'utf8'}).trim()}catch{return ''}};
const sanitize=value=>value.replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'capture';

export function visualEvidenceContext(date=new Date()){
  const appVersion=(process.env.MYFINHUB_QA_APP_VERSION||(existsSync(versionMarker)?readFileSync(versionMarker,'utf8').trim():'v1.3')).trim();
  if(!/^v\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?$/.test(appVersion))throw new Error(`Invalid visual QA app version: ${appVersion}`);
  const timeZone=process.env.MYFINHUB_QA_TIME_ZONE||'Europe/Athens';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  const timestamp=`${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
  const sourceSha=(process.env.GITHUB_SHA||gitValue('rev-parse','HEAD')||'local').trim();
  const shortSha=sourceSha==='local'?'local':sourceSha.slice(0,8);
  const sourceBranch=(process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||gitValue('rev-parse','--abbrev-ref','HEAD')||'local').trim();
  const evidenceRoot=resolve(repositoryRoot,process.env.MYFINHUB_UX_EVIDENCE_ROOT||'visual-qa');
  return {repositoryRoot,appVersion,timeZone,timestamp,generatedAt:date.toISOString(),sourceSha,shortSha,sourceBranch,evidenceRoot};
}

export function prepareSuiteEvidence(key){
  const dir=resolve('/tmp/myfinhub-visual-evidence',sanitize(key));
  rmSync(dir,{recursive:true,force:true});
  mkdirSync(dir,{recursive:true});
  return dir;
}

function pngFiles(root){
  if(!existsSync(root))return [];
  const files=[];
  const visit=dir=>{for(const name of readdirSync(dir)){const path=resolve(dir,name);const stat=statSync(path);if(stat.isDirectory())visit(path);else if(stat.isFile()&&name.toLowerCase().endsWith('.png'))files.push(path)}};
  visit(root);return files.sort();
}

export function persistSuiteEvidence({key,surface,evidenceDirs,context=visualEvidenceContext()}){
  const sources=evidenceDirs.filter(Boolean).filter(existsSync);
  const captures=sources.flatMap((dir,index)=>pngFiles(dir).map(file=>({dir,file,index})));
  if(!captures.length)return 0;
  const targetDir=resolve(context.evidenceRoot,sanitize(surface));mkdirSync(targetDir,{recursive:true});
  const marker=`__qa-${sanitize(key)}__`;
  for(const name of readdirSync(targetDir))if(name.includes(marker)&&(name.endsWith('.png')||name===`qa-${sanitize(key)}.json`))rmSync(resolve(targetDir,name),{force:true});
  const outputs=[];
  for(const capture of captures){
    const sourceName=sanitize(relative(capture.dir,capture.file).replace(/\.png$/i,''));
    const fileName=`${context.appVersion}__${context.timestamp}${marker}${capture.index?`source-${capture.index}__`:''}${sourceName}.png`;
    copyFileSync(capture.file,resolve(targetDir,fileName));outputs.push(`visual-qa/${sanitize(surface)}/${fileName}`);
  }
  writeFileSync(resolve(targetDir,`qa-${sanitize(key)}.json`),`${JSON.stringify({schemaVersion:2,layout:'surface-first-latest-only',appVersion:context.appVersion,suite:key,surface,generatedAt:context.generatedAt,timeZone:context.timeZone,source:{sha:context.sourceSha,shortSha:context.shortSha,branch:context.sourceBranch},screenshots:outputs},null,2)}\n`);
  return outputs.length;
}
