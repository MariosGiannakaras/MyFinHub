import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root=resolve('dist');
const textExtensions=new Set(['.html','.js','.css','.json','.webmanifest','.svg','.txt','.xml','.map']);
const violations=[];

function walk(dir){
  const out=[];
  for(const name of readdirSync(dir)){
    const path=resolve(dir,name);
    const stat=statSync(path);
    if(stat.isDirectory())out.push(...walk(path));
    else if(stat.isFile()&&textExtensions.has(extname(path).toLowerCase())&&stat.size<=8*1024*1024)out.push(path);
  }
  return out;
}

const forbiddenLiterals=[
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CARD_VAULT_KEY',
  'CARD_VAULT_KEY_VERSION',
  '__Host-rheomiq_refresh',
  'rheomiq_refresh',
  'BEGIN PRIVATE KEY',
  'BEGIN RSA PRIVATE KEY',
];

const secretPatterns=[
  {name:'Supabase secret key',re:/sb_secret_[A-Za-z0-9_-]{20,}/g},
  {name:'JWT-like credential',re:/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g},
  {name:'credentialed PostgreSQL URL',re:/postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]{8,}@/gi},
];

function digitsOnly(value){return value.replace(/\D/g,'')}
function luhn(value){
  const digits=digitsOnly(value);
  if(digits.length<13||digits.length>19||/^0+$/.test(digits))return false;
  let sum=0,alternate=false;
  for(let i=digits.length-1;i>=0;i-=1){
    let n=Number(digits[i]);
    if(alternate){n*=2;if(n>9)n-=9}
    sum+=n;alternate=!alternate;
  }
  return sum%10===0;
}

for(const path of walk(root)){
  let text='';
  try{text=readFileSync(path,'utf8')}catch{continue}
  const relative=path.slice(root.length+1).replaceAll('\\','/');
  for(const literal of forbiddenLiterals){
    if(text.includes(literal))violations.push(`${relative}: forbidden runtime secret marker ${literal}`);
  }
  for(const {name,re} of secretPatterns){
    re.lastIndex=0;
    if(re.test(text))violations.push(`${relative}: possible ${name}`);
  }
  const candidates=text.match(/(?:\d[ -]?){13,19}/g)||[];
  for(const candidate of candidates){
    const digits=digitsOnly(candidate);
    if(luhn(digits))violations.push(`${relative}: possible payment-card PAN ending ${digits.slice(-4)}`);
  }
}

if(violations.length){
  console.error('Release privacy artifact guard failed:\n'+violations.map(item=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log('Release privacy artifact guard passed.');
