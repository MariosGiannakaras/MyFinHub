import { isValidDateOnly } from './dateOnly.js';
import { isPositiveCentExactMoneyValue, moneyToCents } from './money.js';
import type { ReceiptProposal } from './receiptDrafts.js';

// A.1135/2023, article 3, FEK B 5368 (2023-09-07), p.60487.
// Decode the printed fields, never request the URL or claim authenticity.
const AADE_PREFIX='https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=';
const SIG=/^([A-Z0-9]{11})([0-9]{8})([A-Fa-f0-9]{30})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{1,12})(?:\.([0-9]{1,2}))?$/;
type FiscalReceiptQr={kind:'aade';identifier:string;date:string;time:string;totalCents:number};
type NonFiscalQrKind='product'|'unsupported'|'external-link'|'malformed'|'multiple';
type DetectedReceiptQr=FiscalReceiptQr|{kind:NonFiscalQrKind};
export type ReceiptQrResult=DetectedReceiptQr|{kind:'none'}|{kind:'unavailable'};
export type ReceiptQrEvidence=DetectedReceiptQr&{
  ocrDate?:string;ocrTotal?:number;ocrCurrency?:string;
  conflicts?:('date'|'amount'|'currency')[];
};
type ReceiptCode={format:string;text:string;valid?:boolean;sequenceSize?:number};
export const MAX_RECEIPT_CODES=8;

export function parseAadeReceiptQr(text:string):FiscalReceiptQr|null{
  if(text.length>256||!text.startsWith(AADE_PREFIX))return null;
  const match=SIG.exec(text.slice(AADE_PREFIX.length));
  if(!match||match[0]!==text.slice(AADE_PREFIX.length))return null;
  const [,serial,number,_signature,yy,mm,dd,hh,min,whole,fraction='']=match;
  const date=`20${yy}-${mm}-${dd}`;
  if(!isValidDateOnly(date)||Number(hh)>23||Number(min)>59)return null;
  const totalCents=Number(whole)*100+Number((fraction+'00').slice(0,2));
  if(!Number.isSafeInteger(totalCents)||totalCents<=0||!isPositiveCentExactMoneyValue(totalCents/100))return null;
  return {kind:'aade',identifier:`${serial}:${number}`,date,time:`${hh}:${min}`,totalCents};
}

export function classifyReceiptCodes(codes:readonly ReceiptCode[]):ReceiptQrResult{
  // The symbol cap is a fail-closed boundary; do not choose a first QR.
  if(codes.length>=MAX_RECEIPT_CODES)return {kind:'multiple'};
  const qr=codes.filter(code=>/^(QRCode(?:Model[12])?|qr_code|MicroQRCode|RMQRCode)$/.test(code.format));
  if(!qr.length)return {kind:codes.some(code=>/^(EAN|UPC)/i.test(code.format))?'product':'none'};
  if(qr.some(code=>code.valid===false||code.sequenceSize!==undefined&&code.sequenceSize>=0))return {kind:qr.length>1?'multiple':'malformed'};
  const unique=[...new Set(qr.map(code=>code.text))];
  if(unique.length!==1)return {kind:'multiple'};
  const text=unique[0];
  const fiscal=parseAadeReceiptQr(text);
  if(fiscal)return fiscal;
  // Only classify links, do not retain, display, visit or proxy their contents.
  if(/^https?:\/\//i.test(text)){
    try{
      const url=new URL(text);
      if(url.hostname==='www1.aade.gr'&&url.pathname==='/tameiakes/myweb/q1.php')return {kind:'malformed'};
      return {kind:'external-link'};
    }catch{return {kind:'malformed'}}
  }
  return {kind:'unsupported'};
}

/** QR suggestions and OCR remain independent evidence. On disagreement keep
 * original OCR fields until the owner explicitly chooses/corrects the values.
 * A foreign OCR total is never silently reinterpreted in EUR. */
export function mergeReceiptQrOcr(qr:ReceiptQrResult,ocr:ReceiptProposal={}):ReceiptProposal{
  if(qr.kind==='none'||qr.kind==='unavailable')return ocr;
  if(qr.kind!=='aade')return {...ocr,qr};
  const conflicts:NonNullable<ReceiptQrEvidence['conflicts']>=[];
  if(ocr.date&&ocr.date!==qr.date)conflicts.push('date');
  if(ocr.total!==undefined&&moneyToCents(ocr.total)!==qr.totalCents)conflicts.push('amount');
  if(ocr.currency&&ocr.currency!=='EUR')conflicts.push('currency');
  const evidence:ReceiptQrEvidence={...qr,ocrDate:ocr.date,ocrTotal:ocr.total,ocrCurrency:ocr.currency,conflicts};
  const total=conflicts.includes('amount')||conflicts.includes('currency')?ocr.total:qr.totalCents/100;
  const date=conflicts.includes('date')?ocr.date:qr.date;
  // Never promote unknown OCR item currency to EUR using only a QR.
  const itemsCurrency=ocr.itemsCurrency??ocr.currency??'UNKNOWN';
  return {...ocr,date,total,currency:ocr.currency??'EUR',qr:evidence,
    ...(ocr.items?{itemsCurrency,itemsBalanced:itemsCurrency==='EUR'&&total!==undefined?ocr.items.reduce((sum,item)=>sum+moneyToCents(item.amount),0)===moneyToCents(total):undefined}:{})};
}
