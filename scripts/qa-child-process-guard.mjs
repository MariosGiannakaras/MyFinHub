import { ChildProcess } from 'node:child_process';

const originalKill=ChildProcess.prototype.kill;
const FORCE_AFTER_MS=2000;
const DRAIN_AFTER_MS=3000;
const guarded=new Set();

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

ChildProcess.prototype.kill=function guardedKill(signal='SIGTERM'){
  const result=originalKill.call(this,signal);
  if(signal!=='SIGTERM'||this.exitCode!==null||guarded.has(this))return result;
  guarded.add(this);
  const forceTimer=setTimeout(()=>{
    if(this.exitCode===null){
      try{originalKill.call(this,'SIGKILL')}catch{}
    }
  },FORCE_AFTER_MS);
  forceTimer.unref();
  this.once('exit',()=>{clearTimeout(forceTimer);guarded.delete(this)});
  return result;
};

export async function drainGuardedChildren(){
  const deadline=Date.now()+DRAIN_AFTER_MS;
  while([...guarded].some(child=>child.exitCode===null)&&Date.now()<deadline)await sleep(50);
  for(const child of guarded){
    if(child.exitCode===null){
      try{originalKill.call(child,'SIGKILL')}catch{}
      try{child.unref()}catch{}
    }
  }
  guarded.clear();
}
