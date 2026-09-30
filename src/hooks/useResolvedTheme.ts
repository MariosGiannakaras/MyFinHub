import { useSyncExternalStore } from 'react';
import { THEME_EVENT, type ResolvedTheme } from '../lib/theme';

function resolvedTheme():ResolvedTheme{
  if(typeof document==='undefined')return 'light';
  return document.documentElement.dataset.theme==='dark'?'dark':'light';
}

function subscribe(listener:()=>void){
  if(typeof window==='undefined'||typeof document==='undefined')return()=>{};
  const handler=()=>listener();
  window.addEventListener(THEME_EVENT,handler);
  window.addEventListener('storage',handler);
  const observer=new MutationObserver(handler);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  return()=>{window.removeEventListener(THEME_EVENT,handler);window.removeEventListener('storage',handler);observer.disconnect()};
}

export function useResolvedTheme(){
  return useSyncExternalStore(subscribe,resolvedTheme,()=> 'light' as ResolvedTheme);
}
