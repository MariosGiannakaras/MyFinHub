import { useEffect, useId, useRef, type RefObject } from 'react';
import { shortcutMatches } from '../lib/shortcuts';
import { acquireModalScrollLock } from '../lib/modalScrollLock';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only live hook-owned modal roots participate; exiting motion DOM is not active.
const modalRoots=new Set<HTMLElement>();
const ownedInert=new Set<HTMLElement>();
let isolationObserver:MutationObserver|null=null;

function topmostModal(){
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter(element=>modalRoots.has(element)&&element.isConnected&&element.getClientRects().length>0).at(-1);
}
function isTopmostModal(root:HTMLElement){return topmostModal()===root}

function syncModalBackground(){
  // Isolate sibling subtrees along the active modal's path, not its ancestors.
  // This works for inline editors and body-portalled date/select dialogs alike.
  const desired=new Set<HTMLElement>();
  for(let node=topmostModal();node&&node!==document.body;node=node.parentElement??undefined){
    for(const sibling of node.parentElement?.children??[]){
      if(sibling!==node&&sibling instanceof HTMLElement)desired.add(sibling);
    }
  }
  // Remove only attributes that this owner introduced, never existing inert.
  for(const element of ownedInert)if(!desired.has(element)){element.inert=false;ownedInert.delete(element)}
  for(const element of desired)if(!element.inert){element.inert=true;ownedInert.add(element)}
}

function acquireModalBackground(root:HTMLElement){
  modalRoots.add(root);
  syncModalBackground();
  if(!isolationObserver){
    isolationObserver=new MutationObserver(syncModalBackground);
    isolationObserver.observe(document.body,{childList:true,subtree:true});
  }
}

// An executing command may synchronously focus its real route destination
// before React unmounts the palette. Ordinary dismissals release in cleanup.
export function releaseModalBackground(root:HTMLElement|null){
  if(!root||!modalRoots.delete(root))return;
  syncModalBackground();
  if(!modalRoots.size){isolationObserver?.disconnect();isolationObserver=null}
}

function canReceiveFocus(element:HTMLElement|null){
  return Boolean(element&&element.matches(FOCUSABLE)&&element.tabIndex>=0&&element.isConnected&&element.getClientRects().length>0&&
    !element.matches(':disabled')&&!element.closest('[inert], [aria-hidden="true"]')&&getComputedStyle(element).visibility==='visible');
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

    const releaseScrollLock=acquireModalScrollLock();
    acquireModalBackground(root);
    const body=document.body;

    const preferredTarget = preferred ? root.querySelector<HTMLElement>(preferred) : null;
    const initial = canReceiveFocus(preferredTarget)
      ? preferredTarget!
      : [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(canReceiveFocus) ?? root;
    queueMicrotask(()=>{if(focusActiveRef.current&&isTopmostModal(root))initial.focus({preventScroll:true})});

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
      // A command may deliberately move focus and scroll into its destination
      // before the exiting dialog unmounts. Preserve that destination; restore
      // the opener and scroll only after ordinary dismissals.
      const focused=document.activeElement;
      // On an explicit nested discard, the focused ConfirmDialog is closing
      // along with this editor. It must not count as an intentional new route
      // destination merely because the two dialogs are DOM siblings.
      const inOtherModal=focused instanceof HTMLElement&&Boolean(focused.closest('[aria-modal="true"]'))&&!root.contains(focused);
      const hasDestination=focused instanceof HTMLElement&&focused.isConnected&&focused!==body&&focused!==opener.current&&!root.contains(focused)&&!inOtherModal;
      // Only the last modal restores the original page scroll. A navigated
      // destination keeps its own scroll, even when the last modal exits.
      releaseModalBackground(root);
      const unlocked=releaseScrollLock();
      if(!hasDestination){
        if(unlocked)window.scrollTo({ ...unlocked, behavior: 'auto' });
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
