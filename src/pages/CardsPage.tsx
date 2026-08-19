import { ArchiveRestore, Plus, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BankBrandMark } from '../components/BankBrandMark';
import { CardCreateDialog } from '../components/CardCreateDialog';
import { InteractivePaymentCard } from '../components/InteractivePaymentCard';
import { useModalFocus } from '../hooks/useModalFocus';
import { archivedCardsForBank, cardBanks, cardsForBank, restoreCard } from '../lib/cards';
import type { CardBank, FinanceData, PaymentCard } from '../types';

export function CardsPage({
  data,onUpsertBank,onUpsertCard,onArchiveCard,onOpenCredit,
}:{
  data:FinanceData;
  onUpsertBank:(bank:CardBank)=>void;
  onUpsertCard:(card:PaymentCard)=>void;
  onArchiveCard:(card:PaymentCard)=>void;
  onOpenCredit:()=>void;
}){
  const banks=useMemo(()=>cardBanks(data),[data]);
  const [bankOpen,setBankOpen]=useState(false);
  const [bankName,setBankName]=useState('');
  const [cardBankId,setCardBankId]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const bankRef=useModalFocus<HTMLElement>(bankOpen,'[data-autofocus="true"]');
  const cardBank=cardBankId?banks.find(bank=>bank.id===cardBankId):undefined;
  const activeCredit=(data.state.cards??[]).find(card=>card.kind==='credit'&&card.active!==false);

  const saveBank=()=>{
    const name=bankName.trim();if(!name){setError('Συμπλήρωσε όνομα τράπεζας.');return}
    if(banks.some(bank=>bank.name.localeCompare(name,'el',{sensitivity:'base'})===0)){setError('Η τράπεζα υπάρχει ήδη.');return}
    const now=Date.now();onUpsertBank({id:`custom-${now}`,name:name.toUpperCase(),order:Math.max(60,...banks.map(bank=>bank.order+10)),custom:true});
    setBankOpen(false);setBankName('');setError('');setMessage('Η τράπεζα προστέθηκε.');
  };
  const saveCard=(card:PaymentCard)=>{
    if(card.kind==='credit'&&card.active!==false&&activeCredit&&activeCredit.id!==card.id){
      setMessage(`Υπάρχει ήδη ενεργή πιστωτική «${activeCredit.nickname}». Αρχειοθέτησέ την πρώτα ώστε η μοναδική credit liability να παραμένει συνδεδεμένη σε μία κάρτα.`);
      return;
    }
    onUpsertCard(card);setMessage(`Η «${card.nickname}» είναι διαθέσιμη από την ίδια card identity σε όλες τις σχετικές ενότητες.`);
  };
  const archive=(card:PaymentCard)=>{onArchiveCard(card);setMessage(`Η «${card.nickname}» αρχειοθετήθηκε χωρίς να χαθεί το ιστορικό της.`)};
  const restore=(card:PaymentCard)=>{
    const next=restoreCard(card);
    if(next.kind==='credit'&&activeCredit&&activeCredit.id!==next.id){setMessage(`Δεν μπορεί να επανέλθει η «${next.nickname}» όσο είναι ενεργή η πιστωτική «${activeCredit.nickname}».`);return}
    onUpsertCard(next);setMessage(`Η «${card.nickname}» επανήλθε με το ίδιο ιστορικό και card id.`)
  };

  return <div className="page-stack cards-prototype-page">
    <section className="page-heading"><div><span className="eyebrow">ΚΑΡΤΕΣ</span><h1>Κάρτες</h1><p>Ενιαία ταυτότητα κάρτας, ασφαλή στοιχεία σε ξεχωριστά vaults και πλήρες ιστορικό μετά από αρχειοθέτηση/επαναφορά.</p></div><div className="heading-actions"><button type="button" className="save-button" onClick={()=>{setBankName('');setError('');setBankOpen(true)}}><Plus/> Προσθήκη τράπεζας</button></div></section>

    <section className="cards-prototype-workspace neo-raised" aria-label="Κάρτες ανά τράπεζα">
      <div className="cards-prototype-grid" style={{'--bank-count':Math.max(1,banks.length)} as React.CSSProperties}>{banks.map(bank=>{
        const active=cardsForBank(data,bank.id);const archived=archivedCardsForBank(data,bank.id);
        return <article className="cards-bank-column" key={bank.id} data-bank={bank.id}>
          <header className="cards-bank-head"><div className="cards-bank-title"><BankBrandMark id={bank.id} name={bank.name}/><span><b>{bank.name}</b><small>{active.length} {active.length===1?'κάρτα':'κάρτες'}</small></span></div><button type="button" className="cards-bank-add" aria-label={`Προσθήκη κάρτας στην ${bank.name}`} onClick={()=>setCardBankId(bank.id)}><Plus/></button></header>
          <div className="cards-bank-stack">{active.map(card=><InteractivePaymentCard key={card.id} card={card} bank={bank} onUpsert={saveCard} onArchive={archive} onOpenCredit={card.kind==='credit'?onOpenCredit:undefined}/>)}{!active.length?<button type="button" className="cards-empty-bank" onClick={()=>setCardBankId(bank.id)}><Plus/><b>Προσθήκη κάρτας</b><span>Διάλεξε σχέδιο, τύπο και δίκτυο.</span></button>:null}</div>
          {archived.length?<details className="cards-archive"><summary><ArchiveRestore/> Αρχειοθετημένες · {archived.length}</summary><div>{archived.map(card=><button type="button" key={card.id} onClick={()=>restore(card)}><ArchiveRestore/><span><b>{card.nickname}</b><small>{card.last4?`•••• ${card.last4} · `:''}ίδιο id / ιστορικό</small></span></button>)}</div></details>:null}
        </article>;
      })}</div>
    </section>

    <div className="logic-note compact card-security-note"><ShieldCheck/><div><b>Δύο ξεχωριστά vaults</b><span>PAN και λήξη αποθηκεύονται μόνο κρυπτογραφημένα στο owner+AAL2 server vault. Το CVV παραμένει κρυπτογραφημένο μόνο στο IndexedDB της συσκευής και δεν αποστέλλεται ποτέ στο API. Η αρχειοθέτηση δεν διαγράφει το server vault ή οικονομικό ιστορικό.</span></div></div>
    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <CardCreateDialog open={Boolean(cardBank)} data={data} banks={cardBank?[cardBank]:banks.slice(0,1)} initialBankId={cardBank?.id} onClose={()=>setCardBankId(null)} onSave={saveCard}/>

    {bankOpen?<div className="editor-backdrop" onMouseDown={()=>setBankOpen(false)}><section ref={bankRef} className="panel neo-raised editor-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="new-bank-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setBankOpen(false)}}}><div className="panel-head"><div><span id="new-bank-title">Νέα τράπεζα</span><small>Οι βασικές τράπεζες διατηρούν την προκαθορισμένη σειρά. Η νέα τράπεζα αποκτά δική της στήλη.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο" onClick={()=>setBankOpen(false)}><X/></button></div><div className="settings-form"><label><span>Όνομα τράπεζας</span><input data-autofocus="true" maxLength={80} value={bankName} onChange={event=>setBankName(event.target.value)} placeholder="π.χ. N26"/></label></div>{error?<div className="form-error" role="alert">{error}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={()=>setBankOpen(false)}>Ακύρωση</button><button type="button" className="save-button" onClick={saveBank}><Plus/> Προσθήκη</button></div></section></div>:null}
  </div>;
}