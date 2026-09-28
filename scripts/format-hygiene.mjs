import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const roots=['src','server','api','scripts','tests','desktop'];
const extensions=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.css']);
const files=[];

function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='dist'||entry.name==='coverage'||entry.name==='release'||entry.name==='.build')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(extensions.has(path.extname(entry.name)))files.push(full);
  }
}
for(const sourceRoot of roots)walk(path.join(root,sourceRoot));

function trailingWhitespace(source){
  const findings=[];
  const lines=source.split('\n');
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/[ \t]+\r?$/.test(line))findings.push(i+1);
  }
  return findings;
}
const fixture='ok\nnot ok  \n\tbad\t\n';
if(JSON.stringify(trailingWhitespace(fixture))!==JSON.stringify([2,3])){
  throw new Error('Formatting hygiene sanity check failed.');
}

const findings=[];
for(const file of files){
  for(const line of trailingWhitespace(fs.readFileSync(file,'utf8'))){
    findings.push(path.relative(root,file).replaceAll(path.sep,'/')+':'+line);
  }
}
if(findings.length){
  console.error('Formatting hygiene failed: trailing whitespace in '+findings.length+' line(s).');
  for(const finding of findings)console.error(' - '+finding);
  process.exit(1);
}
console.log('Formatting hygiene passed: '+files.length+' source file(s), no trailing whitespace.');
