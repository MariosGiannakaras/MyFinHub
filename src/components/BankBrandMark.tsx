import { Banknote, Landmark } from 'lucide-react';

export type BankBrandKey='piraeus'|'revolut'|'alpha'|'payzy'|'viva'|'cash'|'generic';

function normalize(value=''){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR')}

export function bankBrandKey(value?:string,name?:string):BankBrandKey{
  const text=`${normalize(value)} ${normalize(name)}`;
  if(text.includes('piraeus')||text.includes('πειραι'))return 'piraeus';
  if(text.includes('revolut'))return 'revolut';
  if(text.includes('alpha'))return 'alpha';
  if(text.includes('payzy'))return 'payzy';
  if(text.includes('viva'))return 'viva';
  if(text.includes('cash')||text.includes('μετρη'))return 'cash';
  return 'generic';
}

export function BankBrandMark({id,name,compact=true}:{id?:string;name?:string;compact?:boolean}){
  const key=bankBrandKey(id,name);
  if(key==='cash')return <span className="bank-brand-mark bankmark-cash" aria-hidden="true"><Banknote/></span>;
  if(key==='generic')return <span className="bank-brand-mark bankmark-generic" aria-hidden="true"><Landmark/></span>;
  return <span className={`bank-brand-mark bankmark-${key} ${compact?'compact':'wordmark'}`} aria-hidden="true">
    {key==='piraeus'?<><i className="piraeus-symbol"><b/><b/></i>{!compact?<em>ΠΕΙΡΑΙΩΣ</em>:null}</>:null}
    {key==='revolut'?<><i className="brand-letter revolut-letter">R</i>{!compact?<em>Revolut</em>:null}</>:null}
    {key==='alpha'?<><i className="brand-letter alpha-letter">α</i>{!compact?<em>ALPHA BANK</em>:null}</>:null}
    {key==='payzy'?<><i className="brand-letter payzy-letter">p</i>{!compact?<em>payzy</em>:null}</>:null}
    {key==='viva'?<><i className="brand-letter viva-letter">v</i>{!compact?<em>viva</em>:null}</>:null}
  </span>;
}
