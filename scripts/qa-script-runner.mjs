import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { drainGuardedChildren } from './qa-child-process-guard.mjs';

const target=process.argv[2];
if(!target){
  console.error('Rendered QA runner requires a module path.');
  process.exit(2);
}

let code=0;
try{
  await import(pathToFileURL(resolve(target)).href);
}catch(error){
  code=1;
  console.error(error instanceof Error?(error.stack||error.message):String(error));
}

try{
  await drainGuardedChildren();
}catch(error){
  code=1;
  console.error(`Rendered QA child cleanup failed for ${target}: ${error instanceof Error?error.stack||error.message:String(error)}`);
}

if(code===0)console.log(`Rendered QA module completed: ${target}`);
process.exit(code);
