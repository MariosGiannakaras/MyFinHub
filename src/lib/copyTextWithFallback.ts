/**
 * Browser-owned copy path for a value the owner explicitly asked to copy.
 * A denied native clipboard write can fall back to execCommand only if it
 * returns true. The short-lived fallback field is cleared even on exceptions,
 * and the original keyboard focus is restored after the temporary field exits.
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
  const previousFocus=document.activeElement;
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
    // The legacy select() temporarily focuses a hidden field. Return focus to
    // the invoking control, including after a rejected or throwing copy.
    if(typeof HTMLElement!=='undefined'&&previousFocus instanceof HTMLElement&&previousFocus.isConnected){
      previousFocus.focus({preventScroll:true});
    }
  }
}
