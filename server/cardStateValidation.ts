import type { FinanceData } from '../src/types.js';
import { ApiError } from './http.js';

function invalid():never{throw new ApiError(400,'INVALID_DATA','The finance data is invalid.');}
function text(value:unknown,max:number){return typeof value==='string'&&value.length>0&&value.length<=max;}

export function validateCardStateExtensions(state:FinanceData['state']){
  for(const card of state.cards??[]){
    if(card.formFactor!==undefined&&!['physical','virtual'].includes(String(card.formFactor)))invalid();
    if(card.designId!==undefined&&!text(card.designId,200))invalid();
    if(card.archivedAt!==undefined&&!text(card.archivedAt,64))invalid();
    if(card.creditLimit!==undefined&&(!Number.isFinite(Number(card.creditLimit))||Number(card.creditLimit)<0))invalid();
    if(card.active===false&&!card.archivedAt){
      // Legacy archived cards are still valid; the timestamp is added on the next mutation.
    }
  }

  if(state.deletedCards!==undefined&&!Array.isArray(state.deletedCards))invalid();
  if((state.deletedCards?.length??0)>1_000)invalid();
  const cardsById=new Map((state.cards??[]).map(card=>[card.id,card]));
  const deletedCardIds=new Set<string>();
  for(const deleted of state.deletedCards??[]){
    if(!deleted||typeof deleted!=='object'||Array.isArray(deleted))invalid();
    if(Object.keys(deleted).some(key=>!['id','kind','createdAt','deletedAt'].includes(key)))invalid();
    if(!text(deleted.id,200)||deleted.kind!=='credit'||!text(deleted.createdAt,64)||!text(deleted.deletedAt,64))invalid();
    if(cardsById.has(deleted.id)||deletedCardIds.has(deleted.id))invalid();
    deletedCardIds.add(deleted.id);
  }

  for(const event of state.events??[]){
    if(event.cardId!==undefined&&!text(event.cardId,200))invalid();
    if(event.cardId!==undefined&&event.kind!=='card_purchase'&&event.kind!=='card_payment')invalid();
    if(event.cardId!==undefined){
      const card=cardsById.get(event.cardId);
      if(card&&card.kind!=='credit')invalid();
      if(!card&&!deletedCardIds.has(event.cardId))invalid();
    }
  }
}
