import { useEffect, useId, useRef, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isTopmostModal(root: HTMLElement) {
  const modals = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter((element) => element.isConnected && element.getClientRects().length > 0);
  return modals.at(-1) === root;
}

function canReceiveFocus(element:HTMLElement|null){
  return Boolean(element&&element.matches(FOCUSABLE)&&element.isConnected&&element.getClientRects().length>0);
}

function addDescription(element:HTMLElement,id:string){
  const values=(element.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean);
  if(!values.includes(id))element.setAttribute('aria-describedby',[...values,id].join(' '));
}
function removeDescription(element:HTMLElement,id:string){
  const values=(element.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean).filter(value=>value!==id);
  if(values.length)element.setAttribute('aria-describedby',values.join(' '));else element.removeAttribute('aria-describedby');
}

export function useModalFocus<T extends HTMLElement>(open: boolean, preferred?: string, onClose?: () => void): RefObject<T | null> {
  const ref = useRef<T | null>(null);
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
    queueMicrotask(() => initial.focus({ preventScroll: true }));

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
      if (!isTopmostModal(root)) return;
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(canReceiveFocus);
      if (!items.length) { event.preventDefault(); root.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (!root.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey?last:first).focus({ preventScroll: true });
        return;
      }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
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
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' });
      queueMicrotask(() => opener.current?.focus({ preventScroll: true }));
    };
  }, [open, preferred, generatedErrorId]);

  return ref;
}
