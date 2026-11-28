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
      // Nearest alignment can leave the alert and focus ring flush against
      // a moving footer or fractional scroll boundary. Center where possible;
      // the scrollport clamps naturally when the alert is near the end.
      alert.scrollIntoView({block:'center',behavior:'instant'});
      alert.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[id,message,ready]);
}
