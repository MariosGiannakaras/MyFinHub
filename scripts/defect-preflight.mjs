import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const registryFile=path.join(root,'quality/defect-patterns.json');
const severities=['critical','high','medium','low'];
const categories=['security-auth','domain-data','ui-shared','ci-tooling'];

function safePath(value){
  return typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.startsWith('/')&&!value.split('/').some(x=>!x||x==='.'||x==='..');
}

export function validateRegistry(data,base=root){
  const errors=[];
  if(!data||typeof data!=='object'||Array.isArray(data))return ['Registry must be an object'];
  if(data.version!==1)errors.push('Unsupported registry version');
  if(!Array.isArray(data.patterns)||!data.patterns.length)return [...errors,'Patterns must be a nonempty array'];
  const ids=new Set();
  for(const [index,p] of data.patterns.entries()){
    const name='pattern '+index;
    if(!p||typeof p!=='object'){errors.push(name+' must be an object');continue;}
    if(typeof p.id!=='string'||!/^FP-\d{3}$/.test(p.id))errors.push(name+' has invalid ID');
    else if(ids.has(p.id))errors.push(name+' duplicates ID '+p.id);
    else ids.add(p.id);
    for(const key of ['title','rootCause','prevention']){
      if(typeof p[key]!=='string'||!p[key].trim())errors.push(name+' missing '+key);
    }
    if(!severities.includes(p.severity))errors.push(name+' has invalid severity');
    if(!categories.includes(p.category))errors.push(name+' has invalid category');
    if(!Array.isArray(p.paths)||!p.paths.length)errors.push(name+' missing paths');
    else for(const target of p.paths){
      if(!safePath(target))errors.push(name+' invalid relative trigger path');
      else if(!target.includes('*')&&!target.includes('?')&&!fs.existsSync(path.join(base,target)))errors.push(name+' missing trigger file '+target);
    }
    if(!Array.isArray(p.guards)||!p.guards.length)errors.push(name+' missing guards');
    else for(const guard of p.guards){
      if(!safePath(guard)||!/^tests\/[A-Za-z0-9_./-]+\.test\.ts$/.test(guard))errors.push(name+' invalid test guard');
      else if(!fs.existsSync(path.join(base,guard)))errors.push(name+' missing test guard '+guard);
    }
    if(!Array.isArray(p.evidence)||!p.evidence.length)errors.push(name+' missing verified evidence');
    else for(const link of p.evidence){
      if(typeof link!=='string'||!/^https:\/\/github\.com\/MariosGiannakaras\/MyFinHub\/issues\/[1-9]\d*$/.test(link))errors.push(name+' invalid evidence URL');
    }
  }
  return errors;
}

export function globMatches(glob,file){
  let regex='^';
  for(let i=0;i<glob.length;i++){
    const char=glob[i];
    if(char==='*'&&glob[i+1]==='*'){
      i++;
      if(glob[i+1]==='/'){regex+='(?:.*/)?';i++;}
      else regex+='.*';
    }else if(char==='*')regex+='[^/]*';
    else if(char==='?')regex+='[^/]';
    else regex+=/[|\\{}()[\]^$+.]/.test(char)?'\\'+char:char;
  }
  return new RegExp(regex+'$').test(file);
}

function normalize(file){
  const normalized=String(file).replaceAll('\\','/').replace(/^\.\/+/,'');
  if(!safePath(normalized))throw new Error('Expected repository-relative changed path: '+file);
  return normalized;
}

export function buildReport(data,changed){
  const changedFiles=[...new Set(changed.map(normalize))].sort();
  const matches=data.patterns.flatMap(p=>{
    const matchedPaths=changedFiles.filter(f=>p.paths.some(glob=>globMatches(glob,f)));
    return matchedPaths.length?[{
      id:p.id,title:p.title,category:p.category,severity:p.severity,matchedPaths,
      rootCause:p.rootCause,prevention:p.prevention,evidence:p.evidence,guards:p.guards,
    }]:[];
  }).sort((a,b)=>severities.indexOf(a.severity)-severities.indexOf(b.severity)||a.id.localeCompare(b.id));
  const guards=[...new Set(matches.flatMap(p=>p.guards))].sort();
  return {registryVersion:data.version,changedFiles,matches,
    suggestedCommands:guards.length?['npx vitest run '+guards.join(' ')]:[]};
}

function gitFiles(args){
  try{
    return execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']}).toString('utf8').split('\0').filter(Boolean);
  }catch(error){
    throw new Error('Git path discovery failed: '+String(error.stderr||error.message).trim());
  }
}

function parseArgs(args){
  const options={mode:'working',files:[],json:false,check:false};
  let chosen=false;
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--json')options.json=true;
    else if(arg==='--check-registry')options.check=true;
    else if(arg==='--working'){
      if(chosen)throw new Error('Choose one path mode');
      chosen=true;options.mode='working';
    }else if(arg==='--base'){
      if(chosen)throw new Error('Choose one path mode');
      chosen=true;options.mode='base';options.base=args[++i];
      if(!options.base||options.base.startsWith('-'))throw new Error('Missing Git base ref');
    }else if(arg==='--files'){
      if(chosen)throw new Error('Choose one path mode');
      chosen=true;options.mode='files';
      while(args[i+1]&&!args[i+1].startsWith('--'))options.files.push(args[++i]);
      if(!options.files.length)throw new Error('Missing changed paths');
    }else if(arg==='--help'){
      options.help=true;
    }else throw new Error('Unknown argument '+arg);
  }
  if(options.check&&chosen)throw new Error('Registry check does not take paths');
  return options;
}

export function run(args){
  const opts=parseArgs(args);
  if(opts.help){
    console.log('Usage: defect-preflight [--check-registry] [--working | --base <ref> | --files <paths...>] [--json]');
    return;
  }
  const data=JSON.parse(fs.readFileSync(registryFile,'utf8'));
  const errors=validateRegistry(data);
  if(errors.length)throw new Error(errors.join('; '));
  if(opts.check){
    const output={valid:true,patterns:data.patterns.length,guards:new Set(data.patterns.flatMap(p=>p.guards)).size};
    console.log(opts.json?JSON.stringify(output):'Defect registry valid: '+output.patterns+' patterns, '+output.guards+' test guards.');
    return;
  }
  let files=opts.files;
  if(opts.mode==='base')files=gitFiles(['diff','--name-only','-z','--diff-filter=ACMR',opts.base+'...HEAD']);
  if(opts.mode==='working')files=[...gitFiles(['diff','--name-only','-z','--diff-filter=ACMR','HEAD']),...gitFiles(['ls-files','--others','--exclude-standard','-z'])];
  const report=buildReport(data,files);
  if(opts.json){console.log(JSON.stringify(report,null,2));return;}
  console.log('Defect preflight: '+report.changedFiles.length+' paths, '+report.matches.length+' matched classes.');
  for(const hit of report.matches){
    console.log('\n['+hit.severity+'] '+hit.id+': '+hit.title);
    console.log('Files: '+hit.matchedPaths.join(', '));
    console.log('Root cause: '+hit.rootCause);
    console.log('Prevent: '+hit.prevention);
    console.log('Evidence: '+hit.evidence.join(', '));
  }
  for(const command of report.suggestedCommands)console.log('\nSuggested focused checks (not executed): '+command);
  console.log('No match does not certify safety. Existing required CI/security/rendered/desktop gates remain mandatory.');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{run(process.argv.slice(2));}
  catch(error){console.error('Defect preflight: '+error.message);process.exitCode=1;}
}
