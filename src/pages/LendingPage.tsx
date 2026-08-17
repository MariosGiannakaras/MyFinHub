import { HandCoins, UserRound } from 'lucide-react';
import { money } from '../lib/format';
import type { FinanceData } from '../types';

export function LendingPage({data,onQuickAdd}:{data:FinanceData;onQuickAdd:()=>void}){
  const people=new Map<string,{person:string,outstanding:number,events:number}>();
  for(const p of data.seed.lending??[]) people.set(p.person,{person:p.person,outstanding:Number(p.outstanding||0),events:p.entries?.length||0});
  for(const e of data.state.events??[]){if(!e.person||!e.receivableDelta)continue;const p=people.get(e.person)??{person:e.person,outstanding:0,events:0};p.outstanding+=e.receivableDelta;p.events+=1;people.set(e.person,p)}
  const rows=[...people.values()].sort((a,b)=>b.outstanding-a.outstanding);
  const total=rows.reduce((s,p)=>s+p.outstanding,0);
  return <div className="page-stack"><section className="page-heading"><div><span className="eyebrow">RECEIVABLES</span><h1>Δανεικά & επιστροφές</h1><p>Τα χρήματα που σου χρωστούν είναι asset και συμμετέχουν στην καθαρή θέση, όχι spending.</p></div><button className="save-button" onClick={onQuickAdd}><HandCoins size={17}/> Νέα κίνηση</button></section><section className="credit-hero receivable-hero neo-raised"><div><span>Συνολικά προς είσπραξη</span><b>{money.format(total)}</b><small>{rows.length} πρόσωπα με ιστορικό</small></div><HandCoins size={54}/></section><section className="loan-cards">{rows.map(p=><article className="panel neo-raised" key={p.person}><div className="loan-title"><span className="account-mark"><UserRound/></span><div><h3>{p.person}</h3><small>{p.events} καταγεγραμμένες κινήσεις</small></div><b className={p.outstanding>0?'positive':''}>{money.format(p.outstanding)}</b></div><div className="loan-stats" style={{marginTop:16}}><span>Κατάσταση</span><span><b>{p.outstanding>0?'Εκκρεμεί':'Εξοφλημένο'}</b></span></div></article>)}</section></div>;
}
