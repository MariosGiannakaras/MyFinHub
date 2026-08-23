import { useEffect, useRef } from 'react';
import { defaultDesignForCard } from '../lib/cardDesigns';
import { CardVaultClientError, cardVaultErrorMessage, revealCardSecret } from '../lib/cardVaultClient';
import { readLocalCvv } from '../lib/localCvvVault';
import type { CardBank, PaymentCard } from '../types';
import vivaLogo from '../assets/canonical-credit-card/viva-logo.png';
import payzyLogo from '../assets/canonical-credit-card/payzy-logo.png';
import payzyProLogo from '../assets/canonical-credit-card/payzy-pro-logo.png';
import '../styles/canonical-credit-card-stack.css';
import '../styles/canonical-credit-card-host.css';

type Secrets={pan?:string;expiry?:string;cvv?:string};
type RuntimeCard={
  source:PaymentCard;
  id:string;
  bankId:string;
  bankLabel:string;
  template:string;
  name:string;
  kind:PaymentCard['kind'];
  formFactor:PaymentCard['formFactor'];
  network:PaymentCard['network'];
  last4?:string;
};

type StackLayout={
  y:number;s:number;op:number;rz:number;tz:number;z:number;sat:number;bright:number;
  x?:string;
};

type DragState={
  el:HTMLElement;
  startX:number;
  startY:number;
  lastY:number;
};

function formatPan(value:string){return value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();}
function maskNumber(value?:string,last4?:string){
  const digits=String(value??'').replace(/\D/g,'');
  const suffix=digits.slice(-4)||String(last4??'').replace(/\D/g,'').slice(-4);
  if(!suffix)return '•••• •••• •••• ••••';
  return `•••• •••• •••• ${suffix.padStart(4,'•')}`;
}
function maskExpiry(){return '••/••';}
function maskCvv(value?:string){return '•'.repeat(Math.max(3,String(value??'').length));}
function esc(value:unknown){
  return String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[char] as string));
}
function icon(name:'eye'|'eyeoff'|'copy'|'trash'|'x'){
  if(name==='eye')return '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.7"/></svg>';
  if(name==='eyeoff')return '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.8M6.1 6.1C3.8 7.7 2.5 12 2.5 12s3.5 6 9.5 6a10.9 10.9 0 0 0 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  if(name==='copy')return '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2.5"/><rect x="4" y="4" width="11" height="11" rx="2.5"/></svg>';
  if(name==='trash')return '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>';
}
function templateTheme(template:string){
  if(template==='revolut')return 'card-revolut-gradient';
  if(template==='payzy')return 'card-payzy-virtual';
  if(template==='viva')return 'card-viva-business';
  if(template==='custom')return 'card-custom';
  const allowed=/^(revolut|piraeus|alpha|payzy|viva)-[a-z0-9-]+$/;
  return allowed.test(template)?`card-${template}`:'card-custom';
}
function kindLabel(card:RuntimeCard){
  if(card.formFactor==='virtual')return 'Virtual';
  return card.kind==='credit'?'Credit':card.kind==='prepaid'?'Prepaid':'Debit';
}
function hashHue(text:string){
  let hue=0;
  for(const char of String(text??''))hue=(hue*31+char.charCodeAt(0))%360;
  return hue;
}
function cardInlineStyle(card:RuntimeCard){
  return card.template==='custom'?` style="--custom-hue:${hashHue(card.bankLabel)}"`:'';
}
function brandMarkup(card:RuntimeCard){
  const label=card.bankLabel||'Card';
  if(card.template.startsWith('revolut'))return '<span class="card-bank-name revolut-wordmark">Revolut</span>';
  if(card.template.startsWith('piraeus-')){
    if(card.template==='piraeus-green')return '<span class="card-bank-name"><span class="piraeus-slashes" style="margin-right:7px"><i></i><i></i><i></i></span>Piraeus</span>';
    return '<span class="card-bank-name piraeus-logo"><span class="piraeus-slashes"><i></i><i></i><i></i></span>Piraeus</span>';
  }
  if(card.template.startsWith('alpha')){
    if(card.template==='alpha')return '<span class="card-bank-name">ALPHA BANK</span><span class="alpha-enter">enter</span>';
    return '<span class="card-bank-name">ALPHA BANK</span><span class="alpha-bonus-word">bonus</span>';
  }
  if(card.template.startsWith('viva'))return `<img class="brand-logo-img viva-brand-img" src="${esc(vivaLogo)}" alt="Viva Wallet" />`;
  if(card.template.startsWith('payzy')){
    const src=card.template==='payzy-pro'?payzyProLogo:payzyLogo;
    return `<img class="brand-logo-img payzy-brand-img" src="${esc(src)}" alt="payzy by COSMOTE" />`;
  }
  return `<span class="brand-mark custom-mark">${esc(label.slice(0,1))}</span><span class="card-bank-name">${esc(label)}</span>`;
}
function networkMarkup(card:RuntimeCard){
  const type=esc(kindLabel(card));
  if(card.network==='mastercard')return `<div class="card-network mastercard-network" data-network="MASTERCARD"><span class="mastercard-symbol" aria-label="Mastercard"><i></i><i></i></span><span class="mastercard-word">mastercard</span><span class="card-network-type">${type}</span></div>`;
  return `<div class="card-network visa-network" data-network="VISA"><span class="card-network-main">VISA</span><span class="card-network-type">${type}</span></div>`;
}
function stackLayout(i:number):StackLayout{
  return [
    {y:0,s:1,op:1,rz:0,tz:0,z:30,sat:1,bright:1},
    {y:14,s:.972,op:.99,rz:-.5,tz:-8,z:29,sat:.95,bright:.98},
    {y:26,s:.944,op:.95,rz:.5,tz:-16,z:28,sat:.90,bright:.95},
    {y:37,s:.916,op:.89,rz:0,tz:-24,z:27,sat:.86,bright:.92},
  ][i]??{y:42,s:.89,op:.84,rz:0,tz:-30,z:26,sat:.82,bright:.89};
}
function applyLayout(el:HTMLElement,index:number,overrides:Partial<StackLayout>={}){
  const l={...stackLayout(index),...overrides};
  el.style.setProperty('--z',String(l.z));
  el.style.setProperty('--x',l.x??'0px');
  el.style.setProperty('--y',`${l.y}px`);
  el.style.setProperty('--tz',`${l.tz}px`);
  el.style.setProperty('--rz',`${l.rz}deg`);
  el.style.setProperty('--s',String(l.s));
  el.style.setProperty('--op',String(l.op));
  el.style.setProperty('--sat',String(l.sat));
  el.style.setProperty('--bright',String(l.bright));
}
function toRuntimeCard(card:PaymentCard,banks:CardBank[]):RuntimeCard{
  const bank=banks.find(item=>item.id===card.bankId);
  const design=defaultDesignForCard(card);
  return {source:card,id:card.id,bankId:card.bankId,bankLabel:bank?.name??card.bankId,template:design?.id??card.designId??'custom',name:card.nickname,kind:card.kind,formFactor:card.formFactor,network:card.network,last4:card.last4};
}

export function CanonicalCreditCardStack({cards,banks,selectedCardId,onActiveCardChange,onArchiveCard}:{cards:PaymentCard[];banks:CardBank[];selectedCardId?:string;onActiveCardChange?:(cardId:string)=>void;onArchiveCard:(card:PaymentCard)=>void|Promise<void>;}){
  const stageRef=useRef<HTMLDivElement>(null);
  const dotsRef=useRef<HTMLDivElement>(null);
  const statusRef=useRef<HTMLDivElement>(null);
  const renderRef=useRef<()=>void>(()=>{});
  const cardsRef=useRef<RuntimeCard[]>(cards.map(card=>toRuntimeCard(card,banks)));
  const orderRef=useRef<string[]>(cards.map(card=>card.id));
  const secretsRef=useRef(new Map<string,Secrets>());
  const revealedRef=useRef(new Set<string>());
  const archiveRef=useRef(onArchiveCard);
  const activeChangeRef=useRef(onActiveCardChange);
  archiveRef.current=onArchiveCard;
  activeChangeRef.current=onActiveCardChange;

  useEffect(()=>{
    const stage=stageRef.current,dots=dotsRef.current,statusNode=statusRef.current;
    if(!stage||!dots||!statusNode)return;
    let swiping=false;
    let drag:DragState|null=null;
    let ghostNode:HTMLElement|null=null;
    let deleteMode=false;
    const timers=new Set<number>();
    const later=(fn:()=>void,ms:number)=>{const id=window.setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id);return id;};
    const announce=(message:string)=>{statusNode.textContent=message};
    const currentCard=(id:string)=>cardsRef.current.find(card=>card.id===id);

    async function loadSecrets(card:RuntimeCard){
      const cached=secretsRef.current.get(card.id);if(cached)return cached;
      let server:Awaited<ReturnType<typeof revealCardSecret>>={};
      try{server=await revealCardSecret(card.id)}catch(error){if(!(error instanceof CardVaultClientError&&error.code==='CARD_SECRET_NOT_FOUND')){announce(cardVaultErrorMessage(error));return null}}
      let local:string|null=null;try{local=await readLocalCvv(card.id)}catch{announce('Το τοπικό vault CVV δεν είναι διαθέσιμο σε αυτόν τον browser.')}
      const result:Secrets={...server,cvv:local||undefined};secretsRef.current.set(card.id,result);return result;
    }

    function renderCard(card:RuntimeCard,stackIndex:number){
      const revealed=revealedRef.current.has(card.id),secret=secretsRef.current.get(card.id);
      const number=revealed&&secret?.pan?formatPan(secret.pan):maskNumber(secret?.pan,card.last4);
      const expiry=revealed&&secret?.expiry?secret.expiry:maskExpiry();
      const cvv=revealed&&secret?.cvv?secret.cvv:maskCvv(secret?.cvv);
      return `<div class="stack-card${stackIndex===0?' top':''}" data-card-id="${esc(card.id)}"><div class="card-slot"><article class="payment-card ${templateTheme(card.template)}" data-tilt data-revealed="${revealed?'true':'false'}"${cardInlineStyle(card)}><div class="card-inner"><header class="card-header"><div class="card-brand-block"><div class="card-brand">${brandMarkup(card)}</div><div class="card-nickname">${esc(card.name)}</div></div><div class="card-toolbar"><button class="card-icon-btn reveal-btn" type="button" data-id="${esc(card.id)}" aria-pressed="${revealed?'true':'false'}" aria-label="${revealed?'Απόκρυψη':'Εμφάνιση'} στοιχείων">${icon(revealed?'eyeoff':'eye')}</button><button class="card-icon-btn delete-btn" type="button" data-id="${esc(card.id)}" aria-label="Αρχειοθέτηση κάρτας">${icon('trash')}</button></div></header><div class="card-body"><div class="card-number-wrap"><div class="card-number ${revealed?'':'masked'}" data-secret="number">${esc(number)}</div><button class="copy-mini copy-btn" type="button" data-field="pan" data-card-id="${esc(card.id)}" aria-label="Αντιγραφή αριθμού">${icon('copy')}</button></div><div class="card-fields"><div class="card-field"><span class="card-field-label">VALID THRU</span><div class="card-field-line"><span class="card-field-value ${revealed?'':'masked'}" data-secret="expiry">${esc(expiry)}</span><button class="copy-mini copy-btn" type="button" data-field="expiry" data-card-id="${esc(card.id)}" aria-label="Αντιγραφή λήξης">${icon('copy')}</button></div></div><div class="card-field"><span class="card-field-label">CVV</span><div class="card-field-line"><span class="card-field-value ${revealed?'':'masked'}" data-secret="cvv">${esc(cvv)}</span><button class="copy-mini copy-btn" type="button" data-field="cvv" data-card-id="${esc(card.id)}" aria-label="Αντιγραφή CVV">${icon('copy')}</button></div></div>${networkMarkup(card)}</div></div></div></article></div></div>`;
    }
    function clearGhost(){if(ghostNode){ghostNode.remove();ghostNode=null}}
    function render(){
      clearGhost();const cardById=new Map(cardsRef.current.map(card=>[card.id,card])),existingIds=new Set(cardById.keys());
      orderRef.current=orderRef.current.filter(id=>existingIds.has(id));const orderedIds=new Set(orderRef.current);
      for(const card of cardsRef.current)if(!orderedIds.has(card.id)){orderRef.current.push(card.id);orderedIds.add(card.id)}
      const orderedCards=orderRef.current.map(id=>cardById.get(id)).filter((card):card is RuntimeCard=>Boolean(card));
      stage.innerHTML=orderedCards.map((card,index)=>renderCard(card,index)).join('');Array.from(stage.children).forEach((element,index)=>applyLayout(element as HTMLElement,index));
      const activeId=orderRef.current[0]??null;dots.innerHTML=cardsRef.current.map(card=>`<span class="dot${card.id===activeId?' active':''}"></span>`).join('');bindTopCard();attachTilt();
    }
    renderRef.current=render;

    function updateSecretDom(card:RuntimeCard,cardEl:HTMLElement,revealed:boolean){
      const secret=secretsRef.current.get(card.id),numberEl=cardEl.querySelector<HTMLElement>('[data-secret="number"]'),expiryEl=cardEl.querySelector<HTMLElement>('[data-secret="expiry"]'),cvvEl=cardEl.querySelector<HTMLElement>('[data-secret="cvv"]');
      if(!numberEl||!expiryEl||!cvvEl)return;
      numberEl.textContent=revealed&&secret?.pan?formatPan(secret.pan):maskNumber(secret?.pan,card.last4);numberEl.classList.toggle('masked',!revealed);
      expiryEl.textContent=revealed&&secret?.expiry?secret.expiry:maskExpiry();expiryEl.classList.toggle('masked',!revealed);
      cvvEl.textContent=revealed&&secret?.cvv?secret.cvv:maskCvv(secret?.cvv);cvvEl.classList.toggle('masked',!revealed);cardEl.dataset.revealed=revealed?'true':'false';
      const button=cardEl.querySelector<HTMLButtonElement>('.reveal-btn');if(button){button.innerHTML=icon(revealed?'eyeoff':'eye');button.setAttribute('aria-pressed',revealed?'true':'false');button.setAttribute('aria-label',revealed?'Απόκρυψη στοιχείων':'Εμφάνιση στοιχείων')}
    }
    async function toggleReveal(id:string,cardEl:HTMLElement|null){const card=currentCard(id);if(!card||!cardEl)return;if(revealedRef.current.has(id)){revealedRef.current.delete(id);updateSecretDom(card,cardEl,false);return}const secret=await loadSecrets(card);if(!secret||(!secret.pan&&!secret.expiry&&!secret.cvv))return;revealedRef.current.add(id);updateSecretDom(card,cardEl,true)}
    async function copyField(id:string,field:keyof Secrets){const card=currentCard(id);if(!card)return;const secret=secretsRef.current.get(id)??await loadSecrets(card);const value=secret?.[field]??'';if(!value){announce('Δεν υπάρχει αποθηκευμένη τιμή για αντιγραφή');return}try{await navigator.clipboard.writeText(value);announce('Αντιγράφηκε')}catch{try{const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();announce('Αντιγράφηκε')}catch{announce('Δεν ήταν δυνατή η αντιγραφή')}}}
    function bindTopCard(){const top=stage.querySelector<HTMLElement>('.stack-card.top');if(!top)return;top.querySelector<HTMLButtonElement>('.reveal-btn')?.addEventListener('click',event=>{event.stopPropagation();const button=event.currentTarget as HTMLButtonElement;void toggleReveal(button.dataset.id??'',top.querySelector<HTMLElement>('.payment-card'))});top.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const target=event.currentTarget as HTMLButtonElement;void copyField(target.dataset.cardId??'',target.dataset.field as keyof Secrets)}));top.querySelector<HTMLButtonElement>('.delete-btn')?.addEventListener('click',event=>{event.stopPropagation();const button=event.currentTarget as HTMLButtonElement;armDelete(button.dataset.id??'',top.querySelector<HTMLElement>('.payment-card'))});top.addEventListener('pointerdown',startDrag)}
    function attachTilt(){stage.querySelectorAll<HTMLElement>('[data-tilt]').forEach(card=>{let frame:number|null=null,baseRect:DOMRect|null=null;const reset=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;baseRect=null;card.style.transform='perspective(1000px) rotateY(0deg) rotateX(0deg)'};card.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;baseRect=card.getBoundingClientRect()});card.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||card.classList.contains('delete-armed'))return;if(!baseRect)baseRect=card.getBoundingClientRect();const x=(event.clientX-baseRect.left)/baseRect.width,y=(event.clientY-baseRect.top)/baseRect.height,max=6.5,ry=Math.max(-max,Math.min(max,(x-.5)*max*2)),rx=Math.max(-max,Math.min(max,-(y-.5)*max*2));if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{card.style.transform=`perspective(1000px) rotateY(${ry}deg) rotateX(${rx}deg)`})});card.addEventListener('pointerleave',reset)})}
    function startDrag(event:PointerEvent){if(deleteMode||swiping||stage.querySelector('.payment-card.delete-armed')||event.button!==0||(event.target as Element).closest('button')||(event.target as Element).closest('.delete-confirm'))return;const top=stage.querySelector<HTMLElement>('.stack-card.top');if(!top)return;const activeCard=top.querySelector<HTMLElement>('.payment-card');if(activeCard)activeCard.style.transform='perspective(1000px) rotateY(0deg) rotateX(0deg) translate3d(0,0,0)';drag={el:top,startX:event.clientX,startY:event.clientY,lastY:event.clientY};stage.classList.add('dragging');top.classList.add('dragging');top.setPointerCapture(event.pointerId);top.addEventListener('pointermove',moveDrag);top.addEventListener('pointerup',endDrag);top.addEventListener('pointercancel',endDrag)}
    function moveDrag(event:PointerEvent){if(!drag)return;const dy=event.clientY-drag.startY,dx=event.clientX-drag.startX;drag.lastY=event.clientY;const limited=Math.max(-124,Math.min(124,dy)),p=Math.min(1,Math.abs(limited)/124);drag.el.style.setProperty('--x',`${dx*.04}px`);drag.el.style.setProperty('--y',`${limited}px`);drag.el.style.setProperty('--tz',`${p*10}px`);drag.el.style.setProperty('--rz',`${dx/52}deg`);drag.el.style.setProperty('--s',String(1-p*.03));drag.el.style.setProperty('--op',String(1-p*.08));const second=stage.children[1] as HTMLElement|undefined,third=stage.children[2] as HTMLElement|undefined;if(second)applyLayout(second,1,{y:14-p*14,s:.972+p*.028,op:.99+p*.01,tz:-8+p*8});if(third)applyLayout(third,2,{y:26-p*5,s:.944+p*.012,op:.95+p*.01,tz:-16+p*4})}
    function endDrag(event:PointerEvent){if(!drag)return;const dy=event.clientY-drag.startY,velocity=event.clientY-drag.lastY,el=drag.el;el.removeEventListener('pointermove',moveDrag);el.removeEventListener('pointerup',endDrag);el.removeEventListener('pointercancel',endDrag);el.classList.remove('dragging');stage.classList.remove('dragging');drag=null;if(Math.abs(dy)>72||Math.abs(velocity)>16)animateRestack(dy<0?-1:1);else render()}
    function createGhost(top:HTMLElement){clearGhost();ghostNode=top.cloneNode(true) as HTMLElement;ghostNode.classList.remove('top','dragging','restacking');ghostNode.classList.add('ghost-back','restacking');ghostNode.querySelectorAll('.delete-confirm').forEach(node=>node.remove());ghostNode.querySelectorAll<HTMLElement>('button').forEach(button=>{button.tabIndex=-1});stage.appendChild(ghostNode);applyLayout(ghostNode,3,{op:0,s:.88,y:24,tz:-40,z:4,sat:.84,bright:.88});requestAnimationFrame(()=>{if(ghostNode)applyLayout(ghostNode,3,{op:.89,s:.916,y:37,tz:-24,z:4,sat:.84,bright:.90})})}
    function animateRestack(directionSign:number){if(swiping||orderRef.current.length<2)return;swiping=true;const top=stage.querySelector<HTMLElement>('.stack-card.top');if(!top){swiping=false;return}createGhost(top);top.classList.add('restacking');const second=stage.children[1] as HTMLElement|undefined,third=stage.children[2] as HTMLElement|undefined,fourth=stage.children[3] as HTMLElement|undefined;requestAnimationFrame(()=>{top.style.setProperty('--x','0px');top.style.setProperty('--y',`${directionSign<0?-58:58}px`);top.style.setProperty('--tz','12px');top.style.setProperty('--rz',`${directionSign<0?-1.4:1.4}deg`);top.style.setProperty('--s','.96');top.style.setProperty('--op','.94');if(second)applyLayout(second,0,{z:30});if(third)applyLayout(third,1,{z:29});if(fourth)applyLayout(fourth,2,{z:28})});later(()=>{top.style.setProperty('--y',`${directionSign<0?-8:8}px`);top.style.setProperty('--tz','-44px');top.style.setProperty('--rz','0deg');top.style.setProperty('--s','.90');top.style.setProperty('--op','0');top.style.setProperty('--sat','.82');top.style.setProperty('--bright','.88')},150);later(()=>{const first=orderRef.current.shift();if(first)orderRef.current.push(first);render();swiping=false;const active=orderRef.current[0];if(active)activeChangeRef.current?.(active)},470)}
    function armDelete(id:string,cardEl:HTMLElement|null){if(!cardEl||cardEl.querySelector('.delete-confirm'))return;deleteMode=true;stage.classList.add('delete-mode');cardEl.classList.add('delete-armed');cardEl.style.setProperty('--delete-p','0');const overlay=document.createElement('div');overlay.className='delete-confirm';overlay.innerHTML=`<div class="delete-confirm-head"><div class="delete-confirm-copy"><b>Αρχειοθέτηση κάρτας;</b><small>Σύρε το κόκκινο χειριστήριο μέχρι τέρμα δεξιά. Η κάρτα μεταφέρεται στο αρχείο και μπορεί να επανέλθει.</small></div><button class="delete-cancel" type="button" aria-label="Ακύρωση">${icon('x')}</button></div><div class="delete-slider" style="--p:0" role="slider" tabindex="0" aria-label="Σύρε για αρχειοθέτηση κάρτας. Με πληκτρολόγιο χρησιμοποίησε τα βέλη ή End και μετά Enter." aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0%"><span class="delete-slider-label">ΣΥΡΕ ΓΙΑ ΑΡΧΕΙΟΘΕΤΗΣΗ</span><span class="delete-slider-thumb" aria-hidden="true">${icon('trash')}</span></div>`;cardEl.querySelector('.card-inner')?.appendChild(overlay);['pointerdown','pointermove','pointerup','pointercancel','click'].forEach(type=>overlay.addEventListener(type,event=>event.stopPropagation()));const cancel=overlay.querySelector<HTMLButtonElement>('.delete-cancel'),slider=overlay.querySelector<HTMLElement>('.delete-slider'),thumb=overlay.querySelector<HTMLElement>('.delete-slider-thumb');if(!cancel||!slider||!thumb)return;cancel.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation()});cancel.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();disarmDelete(cardEl)});let dragging=false,p=0,pointerId:number|null=null;const setProgress=(value:number)=>{p=Math.max(0,Math.min(1,value));slider.style.setProperty('--p',String(p));cardEl.style.setProperty('--delete-p',String(p));const travel=Math.max(0,slider.clientWidth-thumb.offsetWidth-10);thumb.style.transform=`translateX(${p*travel}px)`;const percent=Math.round(p*100);slider.setAttribute('aria-valuenow',String(percent));slider.setAttribute('aria-valuetext',`${percent}%`)};const progressFromEvent=(event:PointerEvent)=>{const rect=slider.getBoundingClientRect(),thumbW=thumb.offsetWidth||44;return (event.clientX-rect.left-thumbW/2)/(rect.width-thumbW)};const move=(event:PointerEvent)=>{if(!dragging||event.pointerId!==pointerId)return;event.preventDefault();event.stopPropagation();setProgress(progressFromEvent(event))};slider.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();event.stopPropagation();dragging=true;pointerId=event.pointerId;try{slider.setPointerCapture(pointerId)}catch{}setProgress(progressFromEvent(event))});slider.addEventListener('pointermove',move);const finish=(event:PointerEvent)=>{if(!dragging||event.pointerId!==pointerId)return;event.preventDefault();event.stopPropagation();dragging=false;try{slider.releasePointerCapture(pointerId)}catch{}pointerId=null;if(p>=.90){setProgress(1);void commitDelete(id,cardEl);return}setProgress(0)};slider.addEventListener('pointerup',finish);slider.addEventListener('pointercancel',()=>{if(dragging){dragging=false;pointerId=null;setProgress(0)}});slider.addEventListener('keydown',event=>{let next=p,handled=true;switch(event.key){case 'ArrowRight':case 'ArrowUp':next=Math.min(1,p+.10);break;case 'ArrowLeft':case 'ArrowDown':next=Math.max(0,p-.10);break;case 'Home':next=0;break;case 'End':next=1;break;case 'Enter':case ' ':if(p>=.90){event.preventDefault();event.stopPropagation();setProgress(1);void commitDelete(id,cardEl)}return;default:handled=false}if(handled){event.preventDefault();event.stopPropagation();setProgress(next)}});requestAnimationFrame(()=>slider.focus({preventScroll:true}))}
    function disarmDelete(cardEl:HTMLElement|null){if(!cardEl)return;cardEl.querySelector('.delete-confirm')?.remove();cardEl.classList.remove('delete-armed');cardEl.style.removeProperty('--delete-p');deleteMode=false;stage.classList.remove('delete-mode')}
    async function commitDelete(id:string,cardEl:HTMLElement|null){if(!cardEl)return;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches,stackCard=cardEl.closest<HTMLElement>('.stack-card');disarmDelete(cardEl);if(!stackCard||reduce){await finalizeRemove(id);return}swiping=true;const flash=document.createElement('div');flash.className='delete-flash';stackCard.appendChild(flash);cardEl.classList.add('delete-collapsing');const layer=document.createElement('div');layer.className='shred-layer';const pieces:Promise<unknown>[]=[];const slices=9;for(let i=0;i<slices;i++){const wrap=document.createElement('div');wrap.className='shred-slice';const topInset=i*(100/slices),bottomInset=100-(i+1)*(100/slices);wrap.style.clipPath=`inset(${topInset}% 0 ${Math.max(0,bottomInset)}% 0 round 22px)`;const clone=cardEl.cloneNode(true) as HTMLElement;clone.classList.remove('delete-collapsing');clone.querySelectorAll('.delete-confirm').forEach(node=>node.remove());clone.querySelectorAll('button').forEach(button=>button.remove());wrap.appendChild(clone);layer.appendChild(wrap);const side=i%2===0?-1:1,x=side*(44+Math.random()*68),y=(i-(slices/2))*4+(Math.random()*8-4),rot=side*(4+Math.random()*8);pieces.push(wrap.animate([{transform:'translate3d(0,0,0) rotateZ(0deg)',opacity:1,filter:'blur(0px)'},{offset:.28,transform:'translate3d(0,-4px,0) rotateZ(0deg)',opacity:1},{transform:`translate3d(${x}px, ${26+y}px, 0) rotateZ(${rot}deg)`,opacity:0,filter:'blur(2px)'}],{duration:560+Math.random()*140,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}).finished.catch(()=>undefined))}stackCard.appendChild(layer);await Promise.all(pieces);await finalizeRemove(id)}
    async function finalizeRemove(id:string){swiping=false;deleteMode=false;stage.classList.remove('delete-mode');const card=currentCard(id);if(!card)return;try{await archiveRef.current(card.source)}catch{announce('Δεν ήταν δυνατή η αρχειοθέτηση της κάρτας');render();return}cardsRef.current=cardsRef.current.filter(item=>item.id!==id);orderRef.current=orderRef.current.filter(cardId=>cardId!==id);revealedRef.current.delete(id);secretsRef.current.delete(id);render();announce('Η κάρτα αρχειοθετήθηκε');const active=orderRef.current[0];if(active)activeChangeRef.current?.(active)}
    const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'){const armed=stage.querySelector<HTMLElement>('.stack-card.top .payment-card.delete-armed');if(armed){event.preventDefault();disarmDelete(armed);stage.focus({preventScroll:true})}return}if(event.target!==stage)return;if(event.key==='ArrowUp'){event.preventDefault();animateRestack(-1)}else if(event.key==='ArrowDown'){event.preventDefault();animateRestack(1)}};stage.addEventListener('keydown',keydown);render();return()=>{stage.removeEventListener('keydown',keydown);timers.forEach(id=>clearTimeout(id));timers.clear();clearGhost();renderRef.current=()=>{}};
  },[]);

  useEffect(()=>{const next=cards.map(card=>toRuntimeCard(card,banks));cardsRef.current=next;const ids=new Set(next.map(card=>card.id));orderRef.current=orderRef.current.filter(id=>ids.has(id));for(const card of next)if(!orderRef.current.includes(card.id))orderRef.current.push(card.id);if(selectedCardId&&ids.has(selectedCardId)&&orderRef.current[0]!==selectedCardId)orderRef.current=[selectedCardId,...orderRef.current.filter(id=>id!==selectedCardId)];for(const id of [...revealedRef.current])if(!ids.has(id))revealedRef.current.delete(id);for(const id of [...secretsRef.current.keys()])if(!ids.has(id))secretsRef.current.delete(id);renderRef.current();},[cards,banks,selectedCardId]);

  return <section className="mfh-card-stack" id="myfinhub-card-stack" aria-label="Στοίβα πιστωτικών καρτών"><div className="demo-shell"><div className="card-demo"><div ref={stageRef} className="stack-stage" tabIndex={0} aria-label="Στοίβα καρτών. Χρησιμοποίησε τα πλήκτρα πάνω και κάτω για αλλαγή κάρτας."/><div className="meta" aria-label="Θέση στη στοίβα καρτών"><div ref={dotsRef} className="dots" aria-hidden="true"/></div></div></div><div ref={statusRef} className="sr-status" role="status" aria-live="polite"/></section>;
}
