/**
 * Browser-owned copy path for a value the owner explicitly asked to copy.
 * A denied native clipboard write can fall back to execCommand only if it
 * returns true. The short-lived fallback field is cleared even on exceptions.
 */
export async function copyTextWithFallback(value:string):Promise<void>{
  if(navigator.clipboard?.writeText){
    try{
      await navigator.clipboard.writeText(value);
      return;
    }catch{
      // Some embedded browsers only permit the legacy in-document copy.
    }
  }
  const field=document.createElement('textarea');
  field.value=value;
  field.readOnly=true;
  field.style.position='fixed';
  field.style.opacity='0';
  try{
    document.body.appendChild(field);
    field.select();
    if(!document.execCommand('copy'))throw new Error('COPY_FAILED');
  }finally{
    field.value='';
    field.remove();
  }
}
