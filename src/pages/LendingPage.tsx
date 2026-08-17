import { HandCoins, UserRound } from 'lucide-react';
import { money } from '../lib/format';
import { lendingRows } from '../lib/lending';
import type { FinanceData } from '../types';

export function LendingPage({data,onQuickAdd}:{data:FinanceData;onQuickAdd:()=>void}){
  const rows=lendingRows(data);
  const total=rows.reduce((s,p)=>s+p.outstanding,0);
  return <div className="page-stack"><section className="page-heading"><div><span className="eyebrow">RECEIVABLES</span><h1>Δανεικά & επιστροφές</h1><p>Τα χρήματα που σου χρωστούν είναι asset και συμμετέχουν στην καθαρή θέση, όχι spending.</p></div><button className="save-button" onClick={onQuickAdd}><HandCoins size={17}/> Νέα κίνηση</button></section><section className="credit-hero receivable-hero neo-raised"><div><span>Συνολικά προς είσπραξη</span><b>{money.format(total)}</b><small>{rows.length} πρόσωπα με ιστορικό</small></div><HandCoins size={54}/></section><section className="loan-cards">{rows.map(p=><article className="panel neo-raised" key={p.person}><div className="loan-title"><span className="account-mark"><UserRound/></span><div><h3>{p.person}</h3><small>{p.events} καταγεγραμμένες κινήσεις</small></div><b className={p.outstanding>0?'positive':''}>{money.format(p.outstanding)}</b></div><div className="loan-stats" style={{marginTop:16}}><span>Κατάσταση</span><span><b>{p.outstanding>0?'Εκκρεμεί':'Εξοφλημένο'}</b></span></div></article>)}</section></div>;
}
