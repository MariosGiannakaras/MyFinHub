import { ArchiveRestore, CreditCard, Landmark, Plus, ShieldCheck, Trash2, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppTextInput } from '../components/AppTextInput';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { Surface } from '../components/Surface';
import { CardCreateDialog } from '../components/CardCreateDialog';
import { CardDetailsDialog } from '../components/CardDetailsDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FinanceIcon } from '../components/FinanceIcon';
import { FormError } from '../components/FormError';
import { IconButton } from '../components/IconButton';
import { InteractivePaymentCard } from '../components/InteractivePaymentCard';
import { Tooltip } from '../components/Tooltip';
import { useFinancialProviders } from '../hooks/useFinancialProviders';
import { useModalFocus } from '../hooks/useModalFocus';
import { cardBanks, archivedCardsForBank, cardDomainBankCount, cardsForBank, cardWorkspaceBanks, restoreCard } from '../lib/cards';
import { cardVaultErrorMessage } from '../lib/cardVaultClient';
import { categoryPath } from '../lib/categories';
import { effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy } from '../lib/domain';
import { cleanNote, money, shortDate } from '../lib/format';
import { eventKindLabel } from '../lib/ui';
import type { CardBank, FinanceData, PaymentCard } from '../types';
import '../styles/cards-approved-surrounding.css';

type RecentAccountRow={
  id:string;date:string;note:string;category:string;subcategory?:string;kind:string;amount:number;
  income:number;expense:number;refund:number;
};

export function CardsPage({
  data,onUpsertBank,onUpsertCard,onUpsertCardDurably,onStageNewCard,onArchiveCard,onDeleteCard,
}:{
  data:FinanceData;
  onUpsertBank:(bank:CardBank)=>void;
  onUpsertCard:(card:PaymentCard)=>void;
  onUpsertCardDurably:(card:PaymentCard)=>Promise<void>;
  onStageNewCard:(card:PaymentCard)=>Promise<void>;
  onArchiveCard:(card:PaymentCard)=>void;
  onDeleteCard:(card:PaymentCard)=>Promise<void>;
}){
  const providerCatalog=useFinancialProviders();
  const banks=useMemo(()=>cardBanks(data,providerCatalog.providers),[data,providerCatalog.providers]);
  const workspaceBanks=useMemo(()=>cardWorkspaceBanks(data,providerCatalog.providers),[data,providerCatalog.providers]);
  const activeCards=useMemo(()=>banks.flatMap(bank=>cardsForBank(data,bank.id)),[banks,data]);
  const archivedCards=useMemo(()=>banks.flatMap(bank=>archivedCardsForBank(data,bank.id)),[banks,data]);
  const representedBankCount=useMemo(()=>cardDomainBankCount(data),[data]);
  const debitCount=activeCards.filter(card=>card.kind==='debit').length;
  const prepaidCount=activeCards.filter(card=>card.kind==='prepaid').length;
  const recentAccountRows=useMemo<RecentAccountRow[]>(()=>{
    const legacy=effectiveLegacyTransactions(data).map(transaction=>{
      const impact=flowImpactLegacy(data,transaction);
      return {
        id:transaction.id,date:transaction.date,note:cleanNote(transaction.note),category:transaction.category||'Άλλο',subcategory:transaction.subcategory,
        kind:transaction.type,amount:transaction.amount,income:impact.income,expense:impact.expense,refund:impact.refund,
      };
    });
    const events=(data.state.events??[]).filter(event=>!['card_purchase','card_payment'].includes(event.kind)).map(event=>{
      const impact=flowImpactEvent(event);
      return {
        id:event.id,date:event.date,note:cleanNote(event.note),category:event.kind==='split'?'Διαχωρισμός':(event.category||event.kind),subcategory:event.subcategory,
        kind:event.kind,amount:event.amount,income:impact.income,expense:impact.expense,refund:impact.refund,
      };
    });
    return [...legacy,...events]
      .filter(row=>row.income>0||row.expense!==0||row.refund>0)
      .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))
      .slice(0,5);
  },[data]);
  const [bankOpen,setBankOpen]=useState(false);
  const [bankName,setBankName]=useState('');
  const [cardCreateOpen,setCardCreateOpen]=useState(false);
  const [cardBankId,setCardBankId]=useState<string|null>(null);
  const [profileCard,setProfileCard]=useState<PaymentCard|null>(null);
  const [detailsCard,setDetailsCard]=useState<PaymentCard|null>(null);
  const [detailsIsNew,setDetailsIsNew]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState<PaymentCard|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const bankRef=useModalFocus<HTMLElement>(bankOpen,'[data-autofocus="true"]',()=>{setBankOpen(false);setError('')});
  const cardBank=cardBankId?banks.find(bank=>bank.id===cardBankId):undefined;
  const openCardCreate=(bankId?:string)=>{setCardBankId(bankId??null);setCardCreateOpen(true);setMessage('')};
  const closeCardCreate=()=>{setCardCreateOpen(false);setCardBankId(null)};
  const recentCategory=(row:RecentAccountRow)=>row.kind==='split'?'Διαχωρισμός':row.category===row.kind?eventKindLabel(row.kind):categoryPath(row.category,row.subcategory);
  const recentTitle=(row:RecentAccountRow)=>row.note.split(/\r?\n/).map(part=>part.trim()).find(Boolean)||recentCategory(row);
  const recentPositive=(row:RecentAccountRow)=>row.income>0||row.refund>0||row.expense<0;

  const saveBank=()=>{
    const name=bankName.trim();if(!name){setError('Γράψε το όνομα της τράπεζας για να μπορέσουμε να τη δημιουργήσουμε.');return}
    if(banks.some(bank=>bank.name.localeCompare(name,'el',{sensitivity:'base'})===0)){setError('Υπάρχει ήδη τράπεζα με αυτό το όνομα. Έλεγξε το όνομα ή χρησιμοποίησε την υπάρχουσα στήλη.');return}
    const now=Date.now();onUpsertBank({id:`custom-${now}`,name:name.toUpperCase(),order:Math.max(60,...banks.map(bank=>bank.order+10)),custom:true});
    setBankOpen(false);setBankName('');setError('');setMessage('Η νέα τράπεζα αποθηκεύεται.');
  };
  const editCardProfile=(card:PaymentCard)=>{setProfileCard(card);setMessage('')};
  const saveCardProfile=(card:PaymentCard)=>{onUpsertCard(card);setProfileCard(null);setMessage(`Η ενημέρωση της «${card.nickname}» αποθηκεύεται.`)};
  const editCardDetails=(card:PaymentCard)=>{setDetailsIsNew(false);setDetailsCard(card);setMessage('')};
  const createCard=(card:PaymentCard)=>{setDetailsIsNew(true);setDetailsCard(card);setMessage('')};
  const saveCardDetails=async(card:PaymentCard)=>{await onUpsertCardDurably(card);setDetailsCard(null);setDetailsIsNew(false);setMessage(`Η κάρτα «${card.nickname}» και τα ασφαλή στοιχεία επιβεβαιώθηκαν ως αποθηκευμένα.`)};
  const archive=(card:PaymentCard)=>{onArchiveCard(card);setMessage(`Η αρχειοθέτηση της «${card.nickname}» αποθηκεύεται. Τα ασφαλή στοιχεία παραμένουν διαθέσιμα.`)};
  const restore=(card:PaymentCard)=>{onUpsertCard(restoreCard(card));setMessage(`Η επαναφορά της «${card.nickname}» αποθηκεύεται. Τα ασφαλή στοιχεία παραμένουν.`)};
  const confirmDelete=async()=>{
    if(!deleteTarget)return;
    setDeleteBusy(true);setMessage('');
    try{
      const name=deleteTarget.nickname;
      await onDeleteCard(deleteTarget);
      setDeleteTarget(null);
      setMessage(`Η «${name}» διαγράφηκε και ο καθαρισμός του ασφαλούς vault ολοκληρώθηκε.`);
    }catch(error){
      setMessage(error instanceof Error&&error.message.startsWith('Το προφίλ διαγράφηκε')?error.message:cardVaultErrorMessage(error));
    }finally{setDeleteBusy(false)}
  };

  return <div className="page-stack cards-prototype-page">
    <PageHeader eyebrow="ΚΑΡΤΕΣ" title="Κάρτες" description={<><p className="cards-heading-desktop">Οι χρεωστικές και προπληρωμένες κάρτες σου, συγκεντρωμένες με ασφάλεια ανά τράπεζα.</p><p className="cards-heading-mobile">Χρεωστικές και προπληρωμένες κάρτες μόνο για ασφαλή αποθήκευση και προβολή των στοιχείων τους. Οι συναλλαγές καταχωρούνται στους αντίστοιχους λογαριασμούς, όχι στις κάρτες.</p></>} actions={<><Button type="button" variant="secondary" onClick={()=>{setBankName('');setError('');setBankOpen(true)}}><Landmark/> Προσθήκη τράπεζας</Button><Button type="button" variant="primary" onClick={()=>openCardCreate()}><Plus/> Προσθήκη κάρτας</Button></>}/>

    <section className="cards-surrounding-summary" aria-label="Σύνοψη αποθηκευμένων καρτών">
      <Surface as="article" variant="flat" className="cards-surrounding-kpi"><span className="cards-surrounding-kpi-icon banks"><Landmark/></span><div><small>Τράπεζες με κάρτα</small><strong>{representedBankCount}</strong><span>με ενεργή ή αρχειοθετημένη κάρτα</span></div></Surface>
      <Surface as="article" variant="flat" className="cards-surrounding-kpi"><span className="cards-surrounding-kpi-icon active"><CreditCard/></span><div><small>Ενεργές κάρτες</small><strong>{activeCards.length}</strong><span>αποθηκευμένες στο προφίλ καρτών</span></div></Surface>
      <Surface as="article" variant="flat" className="cards-surrounding-kpi"><span className="cards-surrounding-kpi-icon debit"><ShieldCheck/></span><div><small>Χρεωστικές</small><strong>{debitCount}</strong><span>ενεργές και διαθέσιμες</span></div></Surface>
      <Surface as="article" variant="flat" className="cards-surrounding-kpi"><span className="cards-surrounding-kpi-icon prepaid"><WalletCards/></span><div><small>Προπληρωμένες</small><strong>{prepaidCount}</strong><span>{archivedCards.length?`${archivedCards.length} αρχειοθετημένες συνολικά`:'χωρίς αρχειοθετημένες κάρτες'}</span></div></Surface>
    </section>

    <section className="cards-workspace cards-prototype-workspace surface-raised" aria-label="Χρεωστικές και προπληρωμένες κάρτες ανά τράπεζα">
      {workspaceBanks.length>3?<div className="cards-workspace-scroll-hint" aria-hidden="true">Οριζόντια κύλιση για περισσότερες τράπεζες →</div>:null}
      {workspaceBanks.length?<div className="cards-grid cards-prototype-grid" style={{'--bank-count':Math.max(1,workspaceBanks.length)} as React.CSSProperties}>{workspaceBanks.map(bank=>{
        const active=cardsForBank(data,bank.id);const archived=archivedCardsForBank(data,bank.id);
        return <section className="bank-column cards-bank-column" key={bank.id} data-bank={bank.id}>
          <header className="bank-column-head"><div className="bank-column-title"><b>{bank.name}</b><small>{active.length} {active.length===1?'κάρτα':'κάρτες'}</small></div><Tooltip label={`Προσθήκη κάρτας στην ${bank.name}`} side="left"><IconButton type="button" className="bank-add-btn" aria-label={`Προσθήκη κάρτας στην ${bank.name}`} onClick={()=>openCardCreate(bank.id)}><Plus/></IconButton></Tooltip></header>
          <div className="bank-stack">{active.length?active.map(card=><InteractivePaymentCard key={card.id} card={card} bank={bank} onEditCard={editCardProfile} onEditDetails={editCardDetails} onArchive={archive}/>):<button type="button" className="bank-empty" onClick={()=>openCardCreate(bank.id)}>Δεν υπάρχουν χρεωστικές ή προπληρωμένες κάρτες</button>}</div>
          {archived.length?<details className="cards-archive"><summary><ArchiveRestore/> Αρχειοθετημένες · {archived.length}</summary><div className="card-archive-list">{archived.map(card=><article className="card-archive-row" key={card.id}><div className="card-archive-identity"><b>{card.nickname}</b><small>{card.last4?`•••• ${card.last4} · `:''}{card.kind==='prepaid'?'Προπληρωμένη':'Χρεωστική'}</small></div><div className="card-archive-actions"><Button type="button" variant="primary" onClick={()=>restore(card)}><ArchiveRestore/> Επαναφορά</Button><Button type="button" variant="danger" className="danger" onClick={()=>setDeleteTarget(card)}><Trash2/> Οριστική διαγραφή</Button></div></article>)}</div></details>:null}
        </section>;
      })}</div>:<div className="cards-workspace-empty"><CreditCard/><div><b>Δεν έχεις αποθηκευμένη χρεωστική ή προπληρωμένη κάρτα.</b><span>Πρόσθεσε κάρτα και επίλεξε την τράπεζά της στο επόμενο βήμα.</span></div><Button type="button" variant="primary" onClick={()=>openCardCreate()}><Plus/> Προσθήκη κάρτας</Button></div>}
    </section>

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <section className="cards-surrounding-recent surface-raised" aria-label="Πρόσφατες συναλλαγές λογαριασμών">
      <header className="cards-surrounding-recent-head"><div><h2>Πρόσφατες συναλλαγές</h2><p>Από τους λογαριασμούς σου — οι αποθηκευμένες κάρτες δεν δημιουργούν ξεχωριστό ιστορικό συναλλαγών.</p></div></header>
      <div className="cards-surrounding-recent-list">{recentAccountRows.length?recentAccountRows.map(row=>{
        const positive=recentPositive(row);
        return <article className="cards-surrounding-recent-row" key={`${row.kind}-${row.id}`}>
          <FinanceIcon kind={row.kind} category={row.category} subcategory={row.subcategory} note={row.note} settings={data.state.settings} size={19} className="cards-surrounding-recent-icon"/>
          <div className="cards-surrounding-recent-main"><b>{recentTitle(row)}</b><small>{shortDate(row.date)}</small></div>
          <span className="cards-surrounding-recent-category">{recentCategory(row)}</span>
          <strong className={positive?'positive':'negative'}>{positive?'+':'−'} {money.format(Math.abs(row.amount))}</strong>
        </article>;
      }):<div className="cards-surrounding-recent-empty">Δεν υπάρχουν ακόμη πρόσφατες οικονομικές κινήσεις στους λογαριασμούς.</div>}</div>
    </section>

    <CardCreateDialog open={cardCreateOpen} data={data} banks={cardBank?[cardBank]:banks} initialBankId={cardBank?.id} allowedKinds={['debit','prepaid']} onClose={closeCardCreate} onSave={createCard}/>
    <CardCreateDialog open={Boolean(profileCard)} data={data} banks={banks} initialCard={profileCard} allowedKinds={['debit','prepaid']} onClose={()=>setProfileCard(null)} onSave={saveCardProfile}/>
    <CardDetailsDialog open={Boolean(detailsCard)} card={detailsCard} requireCvv={detailsIsNew} motionMode={data.state.settings.motion} onBeforeSave={onStageNewCard} onSaved={saveCardDetails} onCancel={()=>{setDetailsCard(null);setDetailsIsNew(false)}}/>

    {bankOpen?<div className="picker-backdrop open" aria-hidden="false" onMouseDown={()=>setBankOpen(false)}><section ref={bankRef} className="picker compact surface-raised" role="dialog" aria-modal="true" aria-labelledby="new-bank-title" aria-describedby={error?'new-bank-error':undefined} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="picker-head"><div><h2 id="new-bank-title">Νέα τράπεζα</h2><p>Η νέα τράπεζα θα αποκτήσει δική της στήλη και ξεχωριστό κουμπί προσθήκης καρτών.</p></div><IconButton type="button" className="close-picker" aria-label="Κλείσιμο" onClick={()=>setBankOpen(false)}>×</IconButton></div><div className="modal-form-grid one"><div className="modal-field"><label>Όνομα τράπεζας</label><AppTextInput data-autofocus="true" aria-label="Όνομα τράπεζας" maxLength={36} value={bankName} onChange={event=>setBankName(event.target.value)} placeholder="π.χ. N26" invalid={Boolean(error)} aria-describedby={error?'new-bank-error':undefined}/></div></div>{error?<FormError id="new-bank-error">{error}</FormError>:null}<div className="modal-actions"><Button type="button" variant="secondary" className="modal-secondary" onClick={()=>setBankOpen(false)}>Ακύρωση</Button><Button type="button" variant="primary" className="modal-primary" onClick={saveBank}><Plus/> Προσθήκη τράπεζας</Button></div></section></div>:null}

    <ConfirmDialog open={Boolean(deleteTarget)} title="Οριστική διαγραφή κάρτας;" description="Θα διαγραφεί η κάρτα και τα αποθηκευμένα PAN/λήξη/CVV. Δεν υπάρχει οικονομικό ιστορικό συνδεδεμένο με χρεωστικές ή προπληρωμένες κάρτες μέσα στο MyFinHub." confirmLabel="Οριστική διαγραφή" tone="destructive" busy={deleteBusy} motionMode={data.state.settings.motion} onConfirm={()=>void confirmDelete()} onCancel={()=>{if(!deleteBusy)setDeleteTarget(null)}}/>
  </div>;
}
