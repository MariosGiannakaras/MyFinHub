import { useEffect, useId, useRef, type RefObject } from 'react';
import { shortcutMatches } from '../lib/shortcuts';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isTopmostModal(root: HTMLElement) {
  const modals = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter((element) => element.isConnected && element.getClientRects().length > 0);
  return modals.at(-1) === root;
}

function canReceiveFocus(element:HTMLElement|null){
  return Boolean(element&&element.matches(FOCUSABLE)&&element.tabIndex>=0&&element.isConnected&&element.getClientRects().length>0);
}

function addDescription(element:HTMLElement,id:string){
  const values=(element.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean);
  if(!values.includes(id))element.setAttribute('aria-describedby',[...values,id].join(' '));
}
function removeDescription(element:HTMLElement,id:string){
  const values=(element.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean).filter(value=>value!==id);
  if(values.length)element.setAttribute('aria-describedby',values.join(' '));else element.removeAttribute('aria-describedby');
}

export function useModalFocus<T extends HTMLElement>(open: boolean, preferred?: string, onClose?: () => void, focusActive = true): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  // Nested confirmations suspend only the parent's keyboard trap, not its
  // open lifetime. Preserve the original launcher across suspend/resume.
  const focusActiveRef = useRef(focusActive);
  focusActiveRef.current = focusActive;
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const generatedErrorId = `${useId().replace(/:/g,'')}-form-error`;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    if (!root) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const bodyStyle = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
    const htmlOverscroll = html.style.overscrollBehavior;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    const preferredTarget = preferred ? root.querySelector<HTMLElement>(preferred) : null;
    const initial = canReceiveFocus(preferredTarget)
      ? preferredTarget!
      : [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(canReceiveFocus) ?? root;
    if (focusActiveRef.current) queueMicrotask(() => initial.focus({ preventScroll: true }));

    let associatedErrorId='';
    const syncErrorAssociation=()=>{
      const error=root.querySelector<HTMLElement>('.form-error[role="alert"]');
      if(associatedErrorId&&(!error||error.id!==associatedErrorId)){removeDescription(root,associatedErrorId);associatedErrorId=''}
      if(!error)return;
      if(!error.id)error.id=generatedErrorId;
      associatedErrorId=error.id;
      addDescription(root,error.id);
    };
    syncErrorAssociation();
    const errorObserver=new MutationObserver(syncErrorAssociation);
    errorObserver.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['id','role','class']});

    const trap = (event: KeyboardEvent) => {
      if (!focusActiveRef.current || !isTopmostModal(root)) return;
      if (shortcutMatches(event, 'dismiss') && onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(canReceiveFocus);
      event.preventDefault();
      if (!items.length) { root.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (!root.contains(document.activeElement)) {
        (event.shiftKey?last:first).focus({ preventScroll: true });
        return;
      }
      const current=document.activeElement instanceof HTMLElement?document.activeElement:null;
      const currentIndex=current?items.indexOf(current):-1;
      const nextIndex=currentIndex<0
        ?(event.shiftKey?items.length-1:0)
        :event.shiftKey
          ?(currentIndex-1+items.length)%items.length
          :(currentIndex+1)%items.length;
      items[nextIndex].focus({ preventScroll: true });
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      errorObserver.disconnect();
      if(associatedErrorId)removeDescription(root,associatedErrorId);
      body.style.position = bodyStyle.position;
      body.style.top = bodyStyle.top;
      body.style.left = bodyStyle.left;
      body.style.right = bodyStyle.right;
      body.style.width = bodyStyle.width;
      body.style.overflow = bodyStyle.overflow;
      html.style.overscrollBehavior = htmlOverscroll;
      // A command may deliberately move focus and scroll into its destination
      // before the exiting dialog unmounts. Preserve that destination; restore
      // the opener and scroll only after ordinary dismissals.
      const focused=document.activeElement;
      // On an explicit nested discard, the focused ConfirmDialog is closing
      // along with this editor. It must not count as an intentional new route
      // destination merely because the two dialogs are DOM siblings.
      const inOtherModal=focused instanceof HTMLElement&&Boolean(focused.closest('[aria-modal="true"]'))&&!root.contains(focused);
      const hasDestination=focused instanceof HTMLElement&&focused.isConnected&&focused!==body&&focused!==opener.current&&!root.contains(focused)&&!inOtherModal;
      if(!hasDestination){
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' });
        if(inOtherModal){
          // Allow the child's opener-restoration microtask to settle first.
          // A deliberate focus move to a nonmodal route target wins instead.
          requestAnimationFrame(()=>{
            const active=document.activeElement;
            if(active instanceof HTMLElement&&active!==body&&active.isConnected&&!active.closest('[aria-modal="true"]')&&active!==opener.current)return;
            if(opener.current?.isConnected)opener.current.focus({ preventScroll: true });
          });
        }else{
          queueMicrotask(() => {
            if(opener.current?.isConnected)opener.current.focus({ preventScroll: true });
          });
        }
      }
    };
  }, [open, preferred, generatedErrorId]);

  return ref;
}
