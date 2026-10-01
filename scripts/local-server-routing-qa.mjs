import { spawn } from 'node:child_process';

const host='127.0.0.1';
const port=9347;
const origin=`http://${host}:${port}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw new Error(`Local server routing QA assertion failed: ${message}`)};

let output='';
const child=spawn('npm',['start'],{
  env:{...process.env,RHEOMIQ_HOST:host,RHEOMIQ_PORT:String(port),NODE_ENV:'production'},
  stdio:['ignore','pipe','pipe'],
});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk.toString();if(output.length>12000)output=output.slice(-12000)});

async function waitReady(){
  for(let attempt=0;attempt<100;attempt+=1){
    if(child.exitCode!==null)throw new Error(`Local server exited before routing QA was ready.\n${output}`);
    try{const response=await fetch(`${origin}/`);if(response.ok)return}catch{}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for local server routing QA.\n${output}`);
}
async function stop(){
  if(child.exitCode!==null)return;
  await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},2000);child.once('exit',()=>{clearTimeout(timer);resolve()});child.kill('SIGTERM')});
}
async function jsonResponse(path,init){
  const response=await fetch(`${origin}${path}`,init);
  const payload=await response.json().catch(()=>null);
  return {response,payload};
}

try{
  await waitReady();

  const root=await fetch(`${origin}/`);
  assert(root.status===200,'root serves the application entry');

  for(const path of ['/missing-route?source=qa','/missing%20encoded','/nested//missing','/assets/definitely-missing.js']){
    const response=await fetch(`${origin}${path}`);
    const body=await response.text();
    assert(response.status===404,`${path} returns HTTP 404`);
    assert(body.includes('<title>404 · MyFinHub</title>'),`${path} serves the intentional MyFinHub 404`);
    assert(!body.includes('<div id="root"></div>'),`${path} never falls through to the SPA index`);
  }

  const unknown=await jsonResponse('/api/definitely-missing?source=qa');
  assert(unknown.response.status===404,'unknown API route returns 404');
  assert((unknown.response.headers.get('content-type')||'').includes('application/json'),'unknown API route stays JSON');
  assert(unknown.payload?.code==='API_NOT_FOUND','unknown API route returns API_NOT_FOUND');

  const knownMethodCases=[
    {path:'/api/health',method:'POST',allow:'GET'},
    {path:'/api/auth/login',method:'GET',allow:'POST'},
    {path:'/api/data',method:'POST',allow:'GET, PUT'},
    {path:'/api/history',method:'PUT',allow:'GET, POST'},
    {path:'/api/import',method:'GET',allow:'POST'},
    {path:'/api/backup',method:'GET',allow:'POST'},
  ];
  for(const item of knownMethodCases){
    const result=await jsonResponse(item.path,{method:item.method});
    assert(result.response.status===405,`${item.method} ${item.path} returns 405`);
    assert(result.response.headers.get('allow')===item.allow,`${item.path} exposes the exact Allow contract`);
    assert(result.payload?.code==='METHOD_NOT_ALLOWED',`${item.path} returns the JSON method contract`);
  }

  console.log('Local server routing QA passed.');
}finally{
  await stop();
}
