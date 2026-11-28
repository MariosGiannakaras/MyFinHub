import { useEffect } from 'react';

// Both Quick Entry owners keep their form body inert until submission settles.
// An alert can mount before that unlock; focusing only on message changes is
// insufficient. Never focus a busy, closed or backgrounded editor.
export function useQuickEntryErrorFocus(id:string,message:string,ready:boolean){
  useEffect(()=>{
    if(!ready||!message)return;
    const frame=requestAnimationFrame(()=>{
      const alert=document.getElementById(id);
      if(!alert?.isConnected||alert.closest('[inert]'))return;
      alert.scrollIntoView({block:'nearest',behavior:'instant'});
      alert.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[id,message,ready]);
}
