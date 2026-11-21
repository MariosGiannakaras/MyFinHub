import {spawn} from 'node:child_process';
import {rmSync} from 'node:fs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cleanupProfile=profile=>rmSync(profile,{recursive:true,force:true,maxRetries:6,retryDelay:150});
async function stopChild(child){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  await new Promise(resolve=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},2500);
    child.once('exit',()=>{clearTimeout(timer);resolve()});
    child.kill('SIGTERM');
  });
}

/** Isolated, bounded browser launch for synthetic suites; never touches UI assertion timeouts. */
export async function launchQaBrowser({binary,firstPort,profileBase}){
  if(!binary||!Number.isInteger(firstPort)||firstPort<1024||!profileBase.startsWith('/tmp/myfinhub-')){
    throw new Error('Invalid isolated QA browser configuration');
  }
  let lastFailure='';
  for(let attempt=1;attempt<=2;attempt++){
    const port=firstPort+attempt-1,profile=`${profileBase}-${process.pid}-${attempt}`;
    cleanupProfile(profile);
    let diagnostics='',spawnError='';
    const child=spawn(binary,[
      '--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--no-first-run','--no-default-browser-check','about:blank'
    ],{stdio:['ignore','pipe','pipe']});
    const capture=chunk=>{diagnostics+=String(chunk);if(diagnostics.length>8000)diagnostics=diagnostics.slice(-8000)};
    child.stderr?.on('data',capture);child.stdout?.on('data',capture);
    child.on('error',error=>{spawnError=error instanceof Error?error.message:String(error)});
    let online=false;
    for(let tick=0;tick<180;tick++){
      if(spawnError||child.exitCode!==null||child.signalCode!==null)break;
      try{
        const response=await fetch(`http://127.0.0.1:${port}/json/version`);
        if(response.ok){online=true;break}
      }catch{}
      await sleep(150);
    }
    if(online){
      return {port,stop:async()=>{await stopChild(child);cleanupProfile(profile)}};
    }
    lastFailure=`Chromium CDP bootstrap attempt ${attempt} failed at port ${port}: spawn=${spawnError||'none'}, exit=${child.exitCode}, signal=${child.signalCode}, diagnostics=${diagnostics.slice(-5000)}`;
    console.warn(lastFailure);
    await stopChild(child);
    cleanupProfile(profile);
    if(attempt<2)await sleep(500);
  }
  throw new Error(lastFailure||'Chromium CDP bootstrap failed after two isolated attempts');
}
