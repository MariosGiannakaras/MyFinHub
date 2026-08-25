import type { FinanceData } from '../src/types.js';
import { ApiError } from './http.js';

function invalid():never{throw new ApiError(400,'INVALID_DATA','The finance data is invalid.');}
function text(value:unknown,max:number){return typeof value==='string'&&value.length>0&&value.length<=max;}
function billingDay(value:unknown){return Number.isInteger(value)&&Number(value)>=1&&Number(value)<=31;}
function isoDate(value:unknown){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);}

export function validateCardStateExtensions(state:FinanceData['state']){
  for(const card of state.cards??[]){
    if(card.formFactor!==undefined&&!['physical','virtual'].includes(String(card.formFactor)))invalid();
    if(card.designId!==undefined&&!text(card.designId,200))invalid();
    if(card.archivedAt!==undefined&&!text(card.archivedAt,64))invalid();
    if(card.creditLimit!==undefined&&(!Number.isFinite(Number(card.creditLimit))||Number(card.creditLimit)<0))invalid();
    if(card.statementClosingDay!==undefined&&!billingDay(card.statementClosingDay))invalid();
    if(card.statementDueDay!==undefined&&!billingDay(card.statementDueDay))invalid();
    if(card.statementBoundaryRule!==undefined&&!['include-closing-day','next-cycle'].includes(String(card.statementBoundaryRule)))invalid();
    if(card.kind!=='credit'&&(card.statementClosingDay!==undefined||card.statementDueDay!==undefined||card.statementBoundaryRule!==undefined))invalid();
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

  if(state.creditStatements!==undefined&&!Array.isArray(state.creditStatements))invalid();
  if((state.creditStatements?.length??0)>10_000)invalid();
  const statementsById=new Map<string,NonNullable<FinanceData['state']['creditStatements']>[number]>();
  for(const statement of state.creditStatements??[]){
    if(!statement||typeof statement!=='object'||Array.isArray(statement))invalid();
    if(Object.keys(statement).some(key=>!['id','cardId','openDate','closeDate','dueDate','boundaryRule','createdAt','updatedAt'].includes(key)))invalid();
    if(!text(statement.id,300)||!text(statement.cardId,200)||!isoDate(statement.openDate)||!isoDate(statement.closeDate)||!isoDate(statement.dueDate))invalid();
    if(statement.openDate>statement.closeDate||statement.dueDate<=statement.closeDate)invalid();
    if(!['include-closing-day','next-cycle'].includes(String(statement.boundaryRule))||!text(statement.createdAt,64)||!text(statement.updatedAt,64))invalid();
    if(statementsById.has(statement.id))invalid();
    const card=cardsById.get(statement.cardId);if(card&&card.kind!=='credit')invalid();
    if(!card&&!deletedCardIds.has(statement.cardId))invalid();
    statementsById.set(statement.id,statement);
  }

  for(const event of state.events??[]){
    if(event.cardId!==undefined&&!text(event.cardId,200))invalid();
    if(event.cardId!==undefined&&event.kind!=='card_purchase'&&event.kind!=='card_payment')invalid();
    if(event.cardId!==undefined){
      const card=cardsById.get(event.cardId);
      if(card&&card.kind!=='credit')invalid();
      if(!card&&!deletedCardIds.has(event.cardId))invalid();
    }
    if(event.statementId!==undefined){
      if(!text(event.statementId,300)||(event.kind!=='card_purchase'&&event.kind!=='card_payment')||!event.cardId)invalid();
      const statement=statementsById.get(event.statementId);if(!statement||statement.cardId!==event.cardId)invalid();
    }
  }
}
