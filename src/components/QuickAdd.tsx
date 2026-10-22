import { ArrowDownToLine, ArrowLeftRight, BanknoteArrowDown, Check, CircleDollarSign, PiggyBank, RotateCcw, Scale, Split, X } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AppDateInput } from './AppDateInput';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { Button } from './Button';
import { CategorySelectInput } from './CategorySelectInput';
import { ConfirmDialog } from './ConfirmDialog';
import { DialogShell } from './DialogShell';
import { FinanceIcon } from './FinanceIcon';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { MoneyInput } from './MoneyInput';
import { categoryTree, subcategoriesFor } from '../lib/categories';
import { allAccounts, createEvent, frequentDescriptions } from '../lib/domain';
import { manualReconciliationPreview, manualReconciliationDraftError } from '../lib/manualReconciliation';
// Only load the linked fee builder for a confirmed paid transfer.
import {isSafeMoneyValue} from '../lib/money';
import { isSavingsAccount, isSavingContributionSource } from '../lib/accountSelection';
import { ENTRY_INTENTS, structuredPresetFromFrequent, type EntryIntent } from '../lib/entryIntents';
import { entryDefaults, entryDraftError } from '../lib/inputSemantics';
import {
  createExpenseSplitEvent,
  createTransferEvent,
  defaultTransferPair,
  defaultSavingContributionPair,
  savingContributionDraftError,
  splitAllocation,
  splitDraftError,
  transferDraftError,
} from '../lib/ledgerFoundations';
import { preserveLoanPaymentLink } from '../lib/loans';
import { money } from '../lib/format';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { EventKind, FinanceData, FinanceEvent, SplitPart } from '../types';

type FundingSourceRow={id:string;sourceKey:string;amountText:string};

const linkedFeeFor=(data:FinanceData,principalId:string):FinanceEvent|null=>
  (data.state.events??[]).find(event=>event.feeForEventId===principalId)??null;

export type QuickPrefill = { note:string; amount:number; category?:string; subcategory?:string; accountId?:string; parts?:SplitPart[] };

const intentIcons:Record<EntryIntent,ReactNode>={
  expense:<CircleDollarSign/>,
  income:<ArrowDownToLine/>,
  transfer:<ArrowLeftRight/>,
  withdrawal:<BanknoteArrowDown/>,
  saving:<PiggyBank/>,
  refund:<RotateCcw/>,
  reconciliation:<Scale/>,
  split:<Split/>,
};
const intentTones:Record<EntryIntent,{bg:string;color:string}>={expense:{bg:'#fde7f0',color:'#d73368'},income:{bg:'#e1f7ed',color:'#159b68'},transfer:{bg:'#e4f4fb',color:'#207fc3'},withdrawal:{bg:'#efe7ff',color:'#7650ce'},saving:{bg:'#e8f1ff',color:'#3171d8'},refund:{bg:'#e6f0ff',color:'#3478d7'},reconciliation:{bg:'#e7f1ff',color:'#2f73d9'},split:{bg:'#eee8ff',color:'#744ccc'}};
const intentStyle=(intent:EntryIntent)=>({'--quick-intent-bg':intentTones[intent].bg,'--quick-intent-color':intentTones[intent].color} as CSSProperties);
const genericKinds=ENTRY_INTENTS.map(item=>({...item,icon:intentIcons[item.intent]}));
const labelForKind=(kind:EventKind)=>genericKinds.find(item=>item.kind===kind)?.label||'Κίνηση';

export function QuickAdd({ open, data, asOf, initial, initialKind='expense', prefill=null, motionMode='system', onClose, onCreate, onCreateLinkedTransfer }: { open:boolean; data:FinanceData; asOf:string; initial?:FinanceEvent|null; initialKind?:EventKind; prefill?:QuickPrefill|null; motionMode?:'system'|'reduced'|'full'; onClose:()=>void; onCreate:(event:FinanceEvent)=>Promise<void>; onCreateLinkedTransfer?:(principal:FinanceEvent,fee:FinanceEvent|null)=>Promise<void>; currentBalance:(accountId:string)=>number }) {
  const accounts = allAccounts(data).filter(a=>a.kind!=='credit');
  const quickAccounts = accounts.filter(account=>account.showInQuickChoices!==false);
  const accountIds = useMemo(()=>new Set(accounts.map(account=>account.id)),[accounts]);
  const transferDefaults = useMemo(()=>defaultTransferPair(data),[data]);
  const savingDefaults=useMemo(()=>defaultSavingContributionPair(data),[data]);
  const savingSources=accounts.filter(isSavingContributionSource);
  const savingTargets=accounts.filter(isSavingsAccount);
  const fundingCreditCards=(data.state.cards??[]).filter(card=>card.kind==='credit'&&card.active!==false);
  const freshFundingRows=():FundingSourceRow[]=>{
    const ids=[accounts[0]?.id,accounts[1]?.id].filter((id):id is string=>Boolean(id));
    const keys=ids.map(id=>'account:'+id);
    if(keys.length<2&&fundingCreditCards[0])keys.push('credit:'+fundingCreditCards[0].id);
    return [{id:'funding-1',sourceKey:keys[0]||'',amountText:''},
      {id:'funding-2',sourceKey:keys[1]||'',amountText:''}];
  };
  const fallbackAccount=quickAccounts[0]?.id||accounts[0]?.id||'cash';
  const frequent = useMemo(()=>frequentDescriptions(data,'expense',10),[data]);
  const [kind,setKind]=useState<EventKind>('expense');
  const [amount,setAmount]=useState('');
  const [date,setDate]=useState(asOf);
  const [note,setNote]=useState('');
  const [category,setCategory]=useState(data.state.settings.expenseCategories[0]||'Άλλο');
  const [subcategory,setSubcategory]=useState('');
  const [accountId,setAccountId]=useState(data.state.settings.defaultExpenseAccount||fallbackAccount);
  const [from,setFrom]=useState(transferDefaults.from);
  const [to,setTo]=useState(transferDefaults.to);
  const [person,setPerson]=useState('');
  const [actualBalance,setActualBalance]=useState('');
  const [statementMovement,setStatementMovement]=useState('');
  const [feeAmount,setFeeAmount]=useState('');
  const [feeCategory,setFeeCategory]=useState(data.state.settings.expenseCategories[0]||'Άλλο');
  const [multiFundingOpen,setMultiFundingOpen]=useState(false);
  const [fundingRows,setFundingRows]=useState<FundingSourceRow[]>([]);
  const [reconciliationConfirmed,setReconciliationConfirmed]=useState(false);
  const [parts,setParts]=useState<SplitPart[]>([{id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},{id:'p2',label:'',category:data.state.settings.expenseCategories[1]||data.state.settings.expenseCategories[0]||'Άλλο',amount:0}]);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discardOpen,setDiscardOpen]=useState(false);
  const categoryKind=kind==='income'?'income':'expense';
  const splitStatus=useMemo(()=>kind==='split'?splitAllocation(parts):null,[kind,parts]);

  const accountBalancesForEditing=(current:FinanceData,event:FinanceEvent)=>{
    const id=event.accountId||event.legs[0]?.accountId||fallbackAccount;
    const previous=manualReconciliationPreview(current,id,event.date,{editingEventId:event.id}).expectedBalance;
    return Math.round((previous+Number(event.legs.find(leg=>leg.accountId===id)?.amount??0))*100)/100;
  };

  const freshParts=()=>[
    {id:'p1',label:'',category:data.state.settings.expenseCategories[0]||'Άλλο',amount:0},
    {id:'p2',label:'',category:data.state.settings.expenseCategories[1]||data.state.settings.expenseCategories[0]||'Άλλο',amount:0},
  ] satisfies SplitPart[];

  useEffect(()=>{
    if(!open)return;
    setDiscardOpen(false);
    if(initial){
      const defaults=entryDefaults(initial.kind,data.state.settings,fallbackAccount);
      setKind(initial.kind);
      setAmount(String(initial.amount||''));
      setDate(initial.date||asOf);
      setNote(initial.note||'');
      setCategory(initial.category||defaults.category);
      setSubcategory(initial.subcategory||'');
      setAccountId(initial.accountId||initial.legs.find(l=>l.accountId!=='credit-card')?.accountId||defaults.accountId);
      setFrom(initial.fromAccountId||initial.legs.find(l=>l.amount<0)?.accountId||(initial.kind==='saving_cash_offset'?savingDefaults.from:transferDefaults.from));
      setTo(initial.toAccountId||initial.legs.find(l=>l.amount>0)?.accountId||(initial.kind==='saving_cash_offset'?savingDefaults.to:transferDefaults.to));
      setPerson(initial.person||'');
      setParts(initial.parts?.length?initial.parts:freshParts());
      setActualBalance(initial.kind==='reconciliation'?String(accountBalancesForEditing(data,initial)):'');
      setStatementMovement('');setReconciliationConfirmed(false);
      const oldFee=linkedFeeFor(data,initial.id);
      setFeeAmount(oldFee?String(oldFee.amount):'');
      setFeeCategory(oldFee?.category||data.state.settings.expenseCategories[0]||'Άλλο');
      setMultiFundingOpen(Boolean(initial.funding?.length));
      setFundingRows(initial.funding?.length?initial.funding.map((row,index)=>({
        id:'funding-'+(index+1),sourceKey:row.kind+':'+row.sourceId,amountText:String(row.amount)
      })):freshFundingRows());
    }else{
      const defaults=entryDefaults(initialKind,data.state.settings,fallbackAccount);
      setKind(initialKind);
      setAmount(prefill?String(prefill.amount):'');
      setDate(asOf);
      setNote(prefill?.note||'');
      setCategory(prefill?.category||defaults.category);
      setSubcategory(prefill?.subcategory||'');
      setAccountId(prefill?.accountId||defaults.accountId);
      setFrom(initialKind==='saving_cash_offset'?savingDefaults.from:transferDefaults.from);
      setTo(initialKind==='saving_cash_offset'?savingDefaults.to:transferDefaults.to);
      setPerson('');
      setActualBalance('');setStatementMovement('');setReconciliationConfirmed(false);
      setFeeAmount('');setFeeCategory(data.state.settings.expenseCategories[0]||'Άλλο');
      setMultiFundingOpen(false);setFundingRows(freshFundingRows());
      setParts(initialKind==='split'&&prefill?.parts?.length?prefill.parts:freshParts());
    }
    setError('');setDirty(false);
  },[open,initial,initialKind,prefill,asOf,transferDefaults.from,transferDefaults.to,savingDefaults.from,savingDefaults.to]);

  const reconciliation=useMemo(()=>{
    if(kind!=='reconciliation')return null;
    try{
      const verified=actualBalance.trim()?Number(actualBalance.replace(',','.')):null;
      const movement=statementMovement.trim()?Number(statementMovement.replace(',','.')):null;
      return manualReconciliationPreview(data,accountId,date,{verifiedBalance:verified,statementMovement:movement,editingEventId:initial?.kind==='reconciliation'?initial.id:undefined});
    }catch{return null}
  },[data,kind,accountId,date,actualBalance,statementMovement,initial]);
  const reconciliationBase=(id:string)=>id===accountId?(reconciliation?.expectedBalance??0):manualReconciliationPreview(data,id,date,{editingEventId:initial?.kind==='reconciliation'?initial.id:undefined}).expectedBalance;
  const transferLike=['transfer','saving_cash_offset','withdrawal','card_payment'].includes(kind);
  const lendingLike=['lending','repayment'].includes(kind);
  const mark=()=>setDirty(true);
  const filled=(value:string|number|undefined)=>String(value??'').trim()?'true':'false';
  const requestClose=()=>{if(saving)return;if(dirty){setDiscardOpen(true);return}onClose()};
  const confirmDiscard=()=>{setDiscardOpen(false);onClose()};
  useEffect(()=>{
    if(!open||discardOpen||kind!=='split')return;
    queueMicrotask(()=>document.getElementById('quick-add-title')?.closest<HTMLElement>('[role="dialog"]')?.querySelector<HTMLInputElement>('input[aria-label="Ποσό μέρους 1"]')?.focus({preventScroll:true}));
  },[open,discardOpen,kind]);
  const reset=()=>{setAmount('');setNote('');setSubcategory('');setError('');setActualBalance('');setStatementMovement('');setReconciliationConfirmed(false);setFeeAmount('');setMultiFundingOpen(false);setDirty(false)};
  const chooseKind=(next:EventKind)=>{
    const defaults=entryDefaults(next,data.state.settings,fallbackAccount);
    const nextTree=categoryTree(data.state.settings,next==='income'?'income':'expense');
    const nextCategory=nextTree.some(item=>item.name===defaults.category)?defaults.category:(nextTree[0]?.name||defaults.category);
    setKind(next);setError('');setReconciliationConfirmed(false);setMultiFundingOpen(false);setAccountId(defaults.accountId);setCategory(nextCategory);setSubcategory('');mark();
    if(next==='transfer'){setFrom(transferDefaults.from);setTo(transferDefaults.to)}
    if(next==='saving_cash_offset'){setFrom(savingDefaults.from);setTo(savingDefaults.to)}
    if(next==='withdrawal'){setFrom(transferDefaults.from);setTo(accounts.find(account=>account.kind==='cash'&&account.id!==transferDefaults.from)?.id||transferDefaults.to)}
  };
  const submit=async()=>{
    if(saving)return;
    try{
      const draftError=entryDraftError(kind,{amount,person,actualBalance,parts});
      if(draftError) throw new Error(draftError);
      if(kind==='reconciliation'){
        if(!reconciliation)throw new Error('Δεν ήταν δυνατός ο έλεγχος υπολοίπου στη συγκεκριμένη ημερομηνία.');
        const reviewError=manualReconciliationDraftError(reconciliation,reconciliationConfirmed);
        if(reviewError)throw new Error(reviewError);
      }
      const numeric=Number(amount);
      const actual=kind==='reconciliation'?Number(actualBalance):undefined;
      let event:FinanceEvent;
      if(kind==='expense'&&multiFundingOpen){
        const {createMultiSourcePurchaseEvent}=await import('../lib/multiFunding');
        const sources=fundingRows.map(row=>({
          kind:row.sourceKey.startsWith('credit:')?'credit' as const:'account' as const,
          ...(row.sourceKey.startsWith('credit:')?{cardId:row.sourceKey.slice(7)}:{accountId:row.sourceKey.startsWith('account:')?row.sourceKey.slice(8):''}),
          amount:Number(row.amountText.replace(',','.'))
        }));
        event=createMultiSourcePurchaseEvent(data,{date,amount:numeric,note:note||'Αγορά με πολλαπλές πηγές',
          category,subcategory:subcategory||undefined,sources});
      }else if(kind==='transfer'){
        const transferError=transferDraftError(data,{fromAccountId:from,toAccountId:to,amount:numeric});
        if(transferError)throw new Error(transferError);
        event=createTransferEvent(data,{date,amount:numeric,note:note||labelForKind(kind),fromAccountId:from,toAccountId:to});
      }else if(kind==='split'){
        const splitError=splitDraftError(data,{accountId,parts});
        if(splitError)throw new Error(splitError);
        event=createExpenseSplitEvent(data,{date,note:note||labelForKind(kind),accountId,parts});
      }else{
        if(kind==='saving_cash_offset'){
          // Existing financial history can retain an unchanged legacy pair
          // during a note-only edit; never allow a new or changed invalid pair.
          const unchangedLegacyPair=initial?.kind==='saving_cash_offset'&&initial.fromAccountId===from&&initial.toAccountId===to;
          if(!unchangedLegacyPair){
            const savingError=savingContributionDraftError(data,{fromAccountId:from,toAccountId:to,amount:numeric});
            if(savingError)throw new Error(savingError);
          }
        }
        event=createEvent({kind,date,amount:kind==='reconciliation'?Math.abs((reconciliation?.differenceCents??0)/100):numeric,note:note||labelForKind(kind),category,accountId,fromAccountId:from,toAccountId:to,person:person.trim(),actualBalance:actual,currentBalance:reconciliationBase(accountId)});
      }
      if(kind!=='split')event.subcategory=subcategory||undefined;
      if(initial){event.id=initial.id;event.createdAt=initial.createdAt;event.updatedAt=new Date().toISOString();preserveLoanPaymentLink(event,initial)}
      setSaving(true);
      const oldFee=kind==='transfer'&&initial?.kind==='transfer'?linkedFeeFor(data,initial.id):null;
      if(kind==='transfer'&&(feeAmount.trim()||oldFee)){
        if(!onCreateLinkedTransfer)throw new Error('Δεν είναι διαθέσιμη η ασφαλής αποθήκευση συνδεδεμένης προμήθειας.');
        const feeValue=feeAmount.trim()?Number(feeAmount.replace(',','.')):0;
        if(!isSafeMoneyValue(feeValue)||feeValue<0)throw new Error('Η προμήθεια πρέπει να είναι μη αρνητικό ποσό σε λεπτά του ευρώ.');
        const {buildLinkedTransferFee}=await import('../lib/linkedFees');
        const fee=buildLinkedTransferFee(data,event,{amount:feeValue,category:feeCategory});
        await onCreateLinkedTransfer(event,fee);
      }else{
        await onCreate(event);
      }
      reset();onClose();
    }catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
    finally{setSaving(false)}
  };

  const accountOptions=(current:string,pool=accounts)=>{
    const poolIds=new Set(pool.map(account=>account.id));
    return current&&!poolIds.has(current)?<><option value={current} disabled>{accountIds.has(current)?accountDisplayName(data,current):`Μη διαθέσιμος · ${accountDisplayName(data,current)}`}</option>{pool.map(a=><option key={a.id} value={a.id}>{accountDisplayName(data,a.id)}</option>)}</>:pool.map(a=><option key={a.id} value={a.id}>{accountDisplayName(data,a.id)}</option>);
  };

  return <><DialogShell open={open} busy={saving} className="generic-quick-modal" ariaLabelledBy="quick-add-title" ariaDescribedBy="quick-add-description" motionMode={motionMode} preferredFocus='[data-autofocus="true"]' focusActive={!discardOpen} onRequestClose={requestClose}>
      <header><div><small>{initial?'ΕΠΕΞΕΡΓΑΣΙΑ':'ΓΡΗΓΟΡΗ ΚΙΝΗΣΗ'}</small><h2 id="quick-add-title">{initial?'Επεξεργασία κίνησης':'Τι θέλεις να καταγράψεις;'}</h2><p id="quick-add-description">Διάλεξε την ενέργεια που έκανες. Εξειδικευμένες ροές για κάρτες, δόσεις, δάνεια και πάγια συνεχίζουν να ανοίγουν από το αντίστοιχο πλαίσιο.</p></div><IconButton type="button" aria-label="Κλείσιμο καταχώρισης" disabled={saving} onClick={requestClose}><X/></IconButton></header>
      {genericKinds.some(item=>item.kind===kind)?<div className="kind-grid generic-kind-grid" inert={saving} role="group" aria-label="Τι θέλεις να καταγράψεις">{genericKinds.map(k=><button type="button" key={k.kind} className={kind===k.kind?'active':''} aria-pressed={kind===k.kind} onClick={()=>chooseKind(k.kind)}><span style={intentStyle(k.intent)}>{k.icon}</span><b>{k.label}</b><small>{k.description}</small></button>)}</div>:null}
      <div className="entry-body" inert={saving}>
        {kind==='expense'?<div className="frequent-strip"><span>Συχνά</span>{frequent.slice(0,6).map(f=><button type="button" key={f.label} onClick={()=>{const preset=structuredPresetFromFrequent(f);setAmount(String(preset.amount));setCategory(preset.category||category);setSubcategory(preset.subcategory||'');if(preset.accountId&&quickAccounts.some(account=>account.id===preset.accountId))setAccountId(preset.accountId);mark()}}><FinanceIcon settings={data.state.settings} kind="expense" note={f.label} category={f.category} size={14}/><span>{f.label}</span><small>{money.format(f.lastAmount)}</small></button>)}</div>:null}
        <div className="form-grid">
          {kind!=='reconciliation'&&kind!=='split'?<label className="quick-field" data-filled={filled(amount)}><span>Ποσό</span><MoneyInput data-autofocus="true" value={amount} onValueChange={value=>{setAmount(value);mark()}}/></label>:null}
          <label className="quick-field" data-filled="true"><span>Ημερομηνία</span><AppDateInput value={date} onChange={e=>{setDate(e.target.value);setReconciliationConfirmed(false);mark()}}/></label>
          {!transferLike && kind!=='card_purchase'?<label className="quick-field" data-filled="true"><span>Λογαριασμός</span><AppSelectInput value={accountId} onChange={e=>{setAccountId(e.target.value);setReconciliationConfirmed(false);mark()}}>{accountOptions(accountId,quickAccounts)}</AppSelectInput></label>:null}
          {transferLike?<><label className="quick-field" data-filled="true"><span>Από</span><AppSelectInput value={from} onChange={e=>{setFrom(e.target.value);mark()}}>{accountOptions(from,kind==='saving_cash_offset'?savingSources:accounts)}</AppSelectInput></label>{kind!=='card_payment'?<label className="quick-field" data-filled="true"><span>Προς</span><AppSelectInput value={to} onChange={e=>{setTo(e.target.value);mark()}}>{accountOptions(to,kind==='saving_cash_offset'?savingTargets:accounts)}</AppSelectInput></label>:null}</>:null}
          {!['transfer','withdrawal','saving_cash_offset','card_payment','reconciliation','split'].includes(kind)?<label className="quick-field" data-filled="true"><span>Κατηγορία / υποκατηγορία</span><CategorySelectInput settings={data.state.settings} kind={categoryKind} category={category} subcategory={subcategory} aria-label="Κατηγορία ή υποκατηγορία κίνησης" onChange={selection=>{setCategory(selection.category);setSubcategory(selection.subcategory);mark()}}/></label>:null}
          {kind==='transfer'?<><label className="quick-field" data-filled={filled(feeAmount)}><span>Προμήθεια μεταφοράς (€) · προαιρετική</span><MoneyInput value={feeAmount} onValueChange={value=>{setFeeAmount(value);mark()}}/></label>{feeAmount.trim()&&Number(feeAmount)>0?<label className="quick-field"><span>Κατηγορία προμήθειας</span><AppSelectInput value={feeCategory} onChange={e=>{setFeeCategory(e.target.value);mark()}}>{data.state.settings.expenseCategories.map(name=><option value={name} key={name}>{name}</option>)}</AppSelectInput></label>:null}<div className="logic-note compact wide" role="note">Η κύρια μεταφορά δεν είναι έξοδο. Μόνο η πραγματική προμήθεια καταχωρίζεται ως ξεχωριστή δαπάνη, συνδεδεμένη με τη μεταφορά και στην ίδια αποθήκευση.</div></>:null}
          {kind==='expense'?<div className="multi-funding-editor wide" data-multi-funding>
            <label className="multi-funding-choice"><input type="checkbox" checked={multiFundingOpen} onChange={e=>{setMultiFundingOpen(e.target.checked);if(e.target.checked&&fundingRows.length<2)setFundingRows(freshFundingRows());mark()}}/><span>Πληρωμή από περισσότερες πηγές</span></label>
            {multiFundingOpen?<><div className="split-head"><b>Πηγές χρηματοδότησης</b><span aria-live="polite">Άθροισμα: {money.format(fundingRows.reduce((sum,row)=>sum+(Number(row.amountText.replace(',','.'))||0),0))}</span></div>
            {fundingRows.map((row,index)=><div className="multi-funding-row" role="group" aria-label={`Πηγή πληρωμής ${index+1}`} key={row.id}>
              <AppSelectInput aria-label={`Λογαριασμός ή πιστωτική πηγής ${index+1}`} value={row.sourceKey} onChange={e=>{setFundingRows(rows=>rows.map(item=>item.id===row.id?{...item,sourceKey:e.target.value}:item));mark()}}>
                <option value="">Διάλεξε πηγή</option>
                {accounts.map(account=><option key={account.id} value={'account:'+account.id}>{accountDisplayName(data,account.id)}</option>)}
                {fundingCreditCards.map(card=><option key={card.id} value={'credit:'+card.id}>{card.nickname||'Πιστωτική κάρτα'}</option>)}
              </AppSelectInput>
              <MoneyInput aria-label={`Ποσό πηγής ${index+1}`} value={row.amountText} onValueChange={value=>{setFundingRows(rows=>rows.map(item=>item.id===row.id?{...item,amountText:value}:item));mark()}}/>
              <button type="button" aria-label={`Αφαίρεση πηγής ${index+1}`} disabled={fundingRows.length<=2} onClick={()=>{setFundingRows(rows=>rows.filter(item=>item.id!==row.id));mark()}}><X size={16}/></button>
            </div>)}
            <Button type="button" variant="ghost" disabled={fundingRows.length>=12} onClick={()=>{setFundingRows(rows=>[...rows,{id:'funding-'+Date.now(),sourceKey:'',amountText:''}]);mark()}}>+ Προσθήκη πηγής</Button>
            <p className="logic-note compact">Το συνολικό ποσό καταγράφεται μία φορά ως αγορά. Από την πιστωτική υπολογίζεται μόνο το ποσό της δικής της πηγής, όχι ολόκληρη η αγορά.</p></>:null}
          </div>:null}
          {lendingLike?<label className="quick-field" data-filled={filled(person)}><span>Πρόσωπο</span><AppTextInput value={person} onChange={e=>{setPerson(e.target.value);mark()}} placeholder="π.χ. Χρήστος"/></label>:null}
          {kind==='reconciliation'?<><label className="quick-field" data-filled={filled(actualBalance)}><span>Επαληθευμένο υπόλοιπο στη συγκεκριμένη ημερομηνία (€)</span><MoneyInput data-autofocus="true" value={actualBalance} onValueChange={value=>{setActualBalance(value);setReconciliationConfirmed(false);mark()}}/></label><div className="reconcile-preview" role="status" aria-live="polite"><span>Υπολογισμένο υπόλοιπο στις {date}</span><b>{reconciliation?money.format(reconciliation.expectedBalance):'—'}</b><span>Διαφορά που θα διορθωθεί (όχι δαπάνη)</span><strong>{reconciliation?.differenceCents!==null&&reconciliation?.differenceCents!==undefined?money.format(reconciliation.differenceCents/100):'—'}</strong></div><label className="quick-field"><span>Ποσό κίνησης στην κατάσταση (€) · προαιρετικό, για έλεγχο</span><MoneyInput value={statementMovement} onValueChange={value=>{setStatementMovement(value);setReconciliationConfirmed(false);mark()}}/></label><div className="reconcile-preview" aria-label="Κινήσεις προς σύγκριση"><b>Καταγεγραμμένες κινήσεις των προηγούμενων 7 ημερών</b><small>Οι κινήσεις είναι υποψήφιες για δικό σου έλεγχο, όχι αυτόματες αντιστοιχίσεις τραπεζικής κατάστασης.</small>{reconciliation?.candidates.length?<ul>{reconciliation.candidates.map(item=><li key={item.origin+'-'+item.id}>{item.date} · {item.note} · {money.format(item.amount)}{item.sameAmount?' · ίδιο ποσό':''}</li>)}</ul>:<small>Δεν βρέθηκαν καταγεγραμμένες κινήσεις στο διάστημα.</small>}{statementMovement.trim()&&reconciliation?.matchingCandidates===0?<small role="status">Δεν υπάρχει κίνηση ίδιου ποσού στο εξεταζόμενο διάστημα. Έλεγξε την κατάσταση χειροκίνητα πριν διορθώσεις.</small>:null}{reconciliation?.duplicateOnDate?<FormError id="quick-reconciliation-duplicate">Υπάρχει ήδη διόρθωση στον ίδιο λογαριασμό και ημερομηνία.</FormError>:null}</div><label className="quick-field wide"><input type="checkbox" checked={reconciliationConfirmed} onChange={e=>{setReconciliationConfirmed(e.target.checked);mark()}}/> <span>Επιβεβαιώνω ότι έλεγξα την πραγματική κατάσταση λογαριασμού και τις υπάρχουσες κινήσεις. Η διαφορά καταχωρίζεται ως μη δαπανηρή διόρθωση.</span></label></>:null}
          <label className="quick-field wide" data-filled={filled(note)}><span>Σχόλιο <em>προαιρετικό</em></span><AppTextInput value={note} onChange={e=>{setNote(e.target.value);mark()}} placeholder="Σύντομη περιγραφή μόνο αν χρειάζεται"/></label>
        </div>
        {kind==='split'?<div className="split-box"><div className="split-head"><b>Επιμέρους ποσά</b><span aria-live="polite">Σύνολο: {money.format(splitStatus?.total??0)}</span></div>{parts.map((p,i)=>{const subs=subcategoriesFor(data.state.settings,'expense',p.category);return <div className="split-line split-line-taxonomy" key={p.id} role="group" aria-label={`Μέρος ${i+1}`}><input aria-label={`Περιγραφή μέρους ${i+1}`} placeholder="Περιγραφή" value={p.label} onChange={e=>{setParts(ps=>ps.map((x,j)=>j===i?{...x,label:e.target.value}:x));mark()}}/><AppSelectInput aria-label={`Κατηγορία μέρους ${i+1}`} value={p.category} onChange={e=>{setParts(ps=>ps.map((x,j)=>j===i?{...x,category:e.target.value,subcategory:undefined}:x));mark()}}>{categoryTree(data.state.settings,'expense').map(c=><option key={c.name}>{c.name}</option>)}</AppSelectInput>{subs.length?<AppSelectInput aria-label={`Υποκατηγορία μέρους ${i+1}`} value={p.subcategory||''} onChange={e=>{setParts(ps=>ps.map((x,j)=>j===i?{...x,subcategory:e.target.value||undefined}:x));mark()}}><option value="">—</option>{subs.map(value=><option key={value}>{value}</option>)}</AppSelectInput>:null}<input data-autofocus={i===0?true:undefined} aria-label={`Ποσό μέρους ${i+1}`} inputMode="decimal" placeholder="0,00" value={p.amount||''} onChange={e=>{const parsed=Number(e.target.value.replace(',','.'));setParts(ps=>ps.map((x,j)=>j===i?{...x,amount:Number.isFinite(parsed)?parsed:0}:x));mark()}}/><button type="button" aria-label={`Αφαίρεση μέρους ${i+1}`} disabled={parts.length<=2} onClick={()=>{setParts(ps=>ps.filter((_,j)=>j!==i));mark()}}><X size={15}/></button></div>})}<Button type="button" variant="ghost" onClick={()=>{setParts(ps=>[...ps,{id:`p${Date.now()}`,label:'',category:categoryTree(data.state.settings,'expense')[0]?.name||'Άλλο',amount:0}]);mark()}}>+ Προσθήκη μέρους</Button></div>:null}
        {error?<FormError id="quick-add-error">{error}</FormError>:null}
      </div>
      <footer><Button type="button" variant="secondary" disabled={saving} onClick={requestClose}>Ακύρωση</Button><Button type="button" variant="primary" disabled={saving} onClick={()=>void submit()}><Check size={17}/> {saving?'Αποθήκευση…':initial?'Εφαρμογή αλλαγών':'Καταχώριση'}</Button></footer>
  </DialogShell>
  <ConfirmDialog open={discardOpen} title="Απόρριψη μη αποθηκευμένων αλλαγών;" description="Έχεις αλλαγές που δεν έχουν αποθηκευτεί. Αν κλείσεις τώρα την καταχώριση, αυτές οι αλλαγές θα χαθούν." confirmLabel="Απόρριψη" tone="destructive" motionMode={motionMode} onConfirm={confirmDiscard} onCancel={()=>setDiscardOpen(false)}/>
  </>;
}
