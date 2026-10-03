import { ChildProcess } from 'node:child_process';

const originalKill=ChildProcess.prototype.kill;
const FORCE_AFTER_MS=2000;
const UNREF_AFTER_FORCE_MS=750;
const guarded=new WeakSet();

ChildProcess.prototype.kill=function guardedKill(signal='SIGTERM'){
  const result=originalKill.call(this,signal);
  if(signal!=='SIGTERM'||this.exitCode!==null||guarded.has(this))return result;
  guarded.add(this);
  const forceTimer=setTimeout(()=>{
    if(this.exitCode===null){
      try{originalKill.call(this,'SIGKILL')}catch{}
      const unrefTimer=setTimeout(()=>{
        if(this.exitCode===null){
          try{this.unref()}catch{}
        }
      },UNREF_AFTER_FORCE_MS);
      unrefTimer.unref();
    }
  },FORCE_AFTER_MS);
  forceTimer.unref();
  this.once('exit',()=>clearTimeout(forceTimer));
  return result;
};
