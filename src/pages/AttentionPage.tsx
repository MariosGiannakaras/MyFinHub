import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  ListChecks,
  RefreshCw,
  ReceiptText,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { Tooltip } from '../components/Tooltip';
import { attentionDismissDecision, attentionSnoozeDecision, visibleAttentionItems, type AttentionItem } from '../lib/attention';
import { shortDate } from '../lib/format';
import type { AttentionDecision, FinanceData } from '../types';

const actionLabel=(item:AttentionItem)=>item.action==='complete_scheduled'?'Ολοκλήρωση':item.action==='pay_recurring'?'Πληρωμή παγίου':item.action==='pay_loan'?'Πληρωμή δόσης':item.action==='pay_credit'?'Πληρωμή κάρτας':item.action==='collect_lending'?'Καταγραφή επιστροφής':item.action==='open_budgets'?'Προβολή budgets':'Άνοιγμα πρόβλεψης';
const severityLabel=(severity:AttentionItem['severity'])=>severity==='danger'?'Άμεση προσοχή':severity==='warning'?'Σύντομα':'Ενημέρωση';
const kindLabel=(kind:AttentionItem['kind'])=>kind==='scheduled'?'Προγραμματισμένη':kind==='recurring'?'Πάγιο':kind==='loan'?'Δόση δανείου':kind==='credit'?'Πιστωτική':kind==='lending'?'Δανεικά / Οφειλές':kind==='forecast'?'Πρόβλεψη':'Budget';
const sourceLabel=(item:AttentionItem)=>item.kind==='scheduled'?'Προγραμματισμός':item.kind==='recurring'?'Πάγια':item.kind==='loan'?'Δόσεις & Δάνεια':item.kind==='credit'?'Πιστωτική':item.kind==='lending'?'Δανεικά / Οφειλές':item.kind==='forecast'?'Πρόβλεψη 30 ημερών':'Προϋπολογισμοί';
const SeverityIcon=({severity}:{severity:AttentionItem['severity']})=>severity==='danger'?<AlertTriangle/>:severity==='warning'?<Clock3/>:<BellRing/>;
const KindIcon=({kind}:{kind:AttentionItem['kind']})=>kind==='scheduled'?<CalendarClock/>:kind==='recurring'?<RefreshCw/>:kind==='loan'?<WalletCards/>:kind==='credit'?<ReceiptText/>:kind==='lending'?<Landmark/>:kind==='forecast'?<CircleAlert/>:<FileText/>;

function dateContext(asOf:string,dueDate?:string){
  if(!dueDate)return 'Χωρίς ημερομηνία';
  const from=new Date(`${asOf}T12:00:00Z`).getTime();
  const to=new Date(`${dueDate}T12:00:00Z`).getTime();
  const days=Math.round((to-from)/86400000);
  if(days===0)return 'Σήμερα';
  if(days===1)return 'Αύριο';
  if(days>1)return `σε ${days} ημέρες`;
  if(days===-1)return '1 ημέρα πριν';
  return `${Math.abs(days)} ημέρες πριν`;
}

function ApprovedGroup({title,subtitle,tone,items,visible,asOf,onAction,onSnooze,onDismiss,emptyText}:{
  title:string;
  subtitle:string;
  tone:'danger'|'warning'|'pending'|'notice';
  items:AttentionItem[];
  visible:boolean;
  asOf:string;
  onAction:(item:AttentionItem)=>void;
  onSnooze:(item:AttentionItem)=>void;
  onDismiss:(item:AttentionItem)=>void;
  emptyText:string;
}){
  return <section className={`attention-approved-group ${tone}`} aria-labelledby={`attention-${tone}-title`}>
    <header className="attention-approved-group-head">
      <div className="attention-approved-group-title">
        <span className="attention-approved-group-icon" aria-hidden="true">{tone==='danger'?<AlertTriangle/>:tone==='warning'?<Clock3/>:tone==='pending'?<ListChecks/>:<BellRing/>}</span>
        <div><h2 id={`attention-${tone}-title`}>{title} ({items.length})</h2><p>{subtitle}</p></div>
      </div>
      <span className="attention-approved-group-count" aria-label={`${items.length} στοιχεία`}>{items.length}</span>
    </header>
    <div className="attention-approved-table-head" aria-hidden="true"><span>Τύπος</span><span>Περιγραφή</span><span>Λεπτομέρειες</span><span>Ημερομηνία</span><span>Ενέργειες</span></div>
    {items.length?<div className="attention-approved-rows" role="list">{items.map(item=><article role="listitem" className={`attention-row attention-approved-row ${item.severity}`} data-attention-id={item.id} key={item.id}>
      <div className="attention-approved-kind"><span aria-hidden="true"><KindIcon kind={item.kind}/></span><small>{kindLabel(item.kind)}</small></div>
      <div className="attention-approved-copy"><b className={!visible&&(item.kind==='lending'||item.kind==='credit')?'private-text':''}>{item.title}</b><p>{item.reason}</p></div>
      <div className="attention-approved-details"><span>{sourceLabel(item)}</span>{item.amount!==undefined?<b><AnimatedAmount value={item.amount} hidden={!visible}/></b>:<small>Χωρίς ποσό</small>}</div>
      <div className="attention-approved-date">{item.dueDate?<b>{shortDate(item.dueDate)}</b>:<b>—</b>}<small>{dateContext(asOf,item.dueDate)}</small></div>
      <div className="attention-actions attention-approved-actions"><button type="button" className="save-button compact" onClick={()=>onAction(item)}>{actionLabel(item)} <ArrowRight size={14}/></button><Tooltip label="Προσωρινή αναβολή" side="left"><button type="button" className="attention-approved-icon-action" aria-label={`Αναβολή ${item.title}`} onClick={()=>onSnooze(item)}><Clock3/></button></Tooltip>{item.severity!=='danger'?<Tooltip label="Απόκρυψη όσο δεν αλλάζει η κατάσταση" side="left"><button type="button" className="attention-approved-icon-action" aria-label={`Απόκρυψη ${item.title}`} onClick={()=>onDismiss(item)}><XCircle/></button></Tooltip>:null}</div>
    </article>)}</div>:<div className="attention-approved-empty-row"><CheckCircle2/><span>{emptyText}</span></div>}
  </section>;
}

export function AttentionPage({data,asOf,onAction,onDecision}:{data:FinanceData;asOf:string;onAction:(item:AttentionItem)=>void;onDecision:(id:string,decision:AttentionDecision)=>void}){
  const [visible,setVisible]=useState(false);
  const [message,setMessage]=useState('');
  const items=useMemo(()=>visibleAttentionItems(data,asOf),[data,asOf]);
  const groups=useMemo(()=>{
    const danger=items.filter(item=>item.severity==='danger');
    const warning=items.filter(item=>item.severity==='warning');
    const info=items.filter(item=>item.severity==='info');
    const notices=info.filter(item=>item.kind==='forecast'||item.kind==='budget');
    const pending=info.filter(item=>item.kind!=='forecast'&&item.kind!=='budget');
    return {danger,warning,pending,notices};
  },[items]);
  const decide=(item:AttentionItem,kind:'snooze'|'dismiss')=>{try{const decision=kind==='snooze'?attentionSnoozeDecision(item,asOf):attentionDismissDecision(item);onDecision(item.id,decision);setMessage(kind==='snooze'?`Η υπενθύμιση «${item.title}» αναβλήθηκε προσωρινά.`:`Η ενημέρωση «${item.title}» κρύφτηκε όσο δεν αλλάζει η κατάστασή της.`)}catch(reason){setMessage(reason instanceof Error?reason.message:'Δεν ήταν δυνατή η αλλαγή της υπενθύμισης.')}};
  const counts={danger:groups.danger.length,warning:groups.warning.length,pending:groups.pending.length,notices:groups.notices.length};

  return <div className="page-stack attention-page attention-approved-page">
    <div className="attention-approved-desktop">
      <section className="page-heading attention-approved-heading">
        <span className="attention-approved-heading-icon" aria-hidden="true"><AlertTriangle/></span>
        <div><h1>Χρειάζεται προσοχή</h1><p>Σημεία που απαιτούν την προσοχή σου για τα οικονομικά σου.</p></div>
        <button type="button" className="secondary privacy-toggle" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>} {visible?'Απόκρυψη ποσών':'Εμφάνιση ποσών'}</button>
      </section>

      <section className="attention-approved-summary-grid" aria-label="Σύνοψη εκκρεμοτήτων">
        <article className="attention-approved-summary-card danger"><span><AlertTriangle/></span><div><small>Επείγοντα</small><b>{counts.danger}</b><em>Άμεση ενέργεια</em></div></article>
        <article className="attention-approved-summary-card warning"><span><Clock3/></span><div><small>Σύντομα</small><b>{counts.warning}</b><em>Τις επόμενες 7 ημέρες</em></div></article>
        <article className="attention-approved-summary-card pending"><span><ListChecks/></span><div><small>Εκκρεμότητες</small><b>{counts.pending}</b><em>Σε αναμονή</em></div></article>
        <article className="attention-approved-summary-card notice"><span><BellRing/></span><div><small>Ενημερώσεις</small><b>{counts.notices}</b><em>Πληροφοριακά</em></div></article>
      </section>

      {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

      <ApprovedGroup title="Επείγοντα" subtitle="Άμεσα θέματα που απαιτούν την προσοχή σου." tone="danger" items={groups.danger} visible={visible} asOf={asOf} onAction={onAction} onSnooze={item=>decide(item,'snooze')} onDismiss={item=>decide(item,'dismiss')} emptyText="Δεν υπάρχουν επείγοντα θέματα αυτή τη στιγμή."/>
      <ApprovedGroup title="Σύντομα" subtitle="Θέματα που χρειάζονται προγραμματισμό τις επόμενες ημέρες." tone="warning" items={groups.warning} visible={visible} asOf={asOf} onAction={onAction} onSnooze={item=>decide(item,'snooze')} onDismiss={item=>decide(item,'dismiss')} emptyText="Δεν υπάρχει κάτι που λήγει σύντομα."/>
      <ApprovedGroup title="Εκκρεμότητες" subtitle="Γνωστές ενέργειες χαμηλότερης προτεραιότητας που παραμένουν ενεργές." tone="pending" items={groups.pending} visible={visible} asOf={asOf} onAction={onAction} onSnooze={item=>decide(item,'snooze')} onDismiss={item=>decide(item,'dismiss')} emptyText="Δεν υπάρχουν άλλες ενεργές εκκρεμότητες."/>
      <ApprovedGroup title="Ενημερώσεις" subtitle="Πληροφοριακά σήματα από τα αποθηκευμένα δεδομένα και τις ντετερμινιστικές προβλέψεις." tone="notice" items={groups.notices} visible={visible} asOf={asOf} onAction={onAction} onSnooze={item=>decide(item,'snooze')} onDismiss={item=>decide(item,'dismiss')} emptyText="Δεν υπάρχουν ξεχωριστές πληροφοριακές ενημερώσεις αυτή τη στιγμή."/>

      <section className="attention-approved-shortcuts" aria-labelledby="attention-shortcuts-title">
        <header><span aria-hidden="true">↯</span><div><h2 id="attention-shortcuts-title">Χρήσιμες ενέργειες</h2><p>Συντομεύσεις για γρήγορη διαχείριση.</p></div></header>
        <div className="attention-approved-shortcut-grid">
          <a href="#/recurring"><span><ReceiptText/></span><b>Εξόφληση παγίων</b><small>Δες όλα τα πάγια</small><em>Πάγια <ArrowRight/></em></a>
          <a href="#/planning"><span><CalendarClock/></span><b>Προγραμματισμένες κινήσεις</b><small>Διαχείριση μελλοντικών πληρωμών</small><em>Προγραμματισμός <ArrowRight/></em></a>
          <a href="#/loans"><span><WalletCards/></span><b>Στοιχεία δανείων</b><small>Έλεγχος δόσεων και υπολοίπων</small><em>Δόσεις &amp; Δάνεια <ArrowRight/></em></a>
          <a href="#/transactions"><span><ListChecks/></span><b>Συναλλαγές</b><small>Έλεγχος και κατηγοριοποίηση</small><em>Συναλλαγές <ArrowRight/></em></a>
        </div>
      </section>

      <section className={`attention-approved-all-clear ${counts.danger?'has-urgent':''}`} id="attention-how-it-works">
        <div className="attention-approved-clear-head"><CheckCircle2/><div><b>{counts.danger?'Η λίστα είναι ενημερωμένη':'Όλα υπό έλεγχο!'}</b><span>{counts.danger?'Τα γνωστά επείγοντα θέματα εμφανίζονται παραπάνω με τις πραγματικές διαθέσιμες ενέργειες.':'Δεν υπάρχουν άλλα επείγοντα θέματα αυτή τη στιγμή.'}</span></div></div>
        <div className="attention-approved-tip"><span aria-hidden="true">☼</span><div><b>Συμβουλή</b><small>Η σελίδα βασίζεται μόνο σε αποθηκευμένες ημερομηνίες, πραγματικές οφειλές/όρια, δηλωμένα budgets και τη ντετερμινιστική προβολή 30 ημερών.</small></div><a href="#/dashboard">Επιστροφή στην επισκόπηση <ArrowRight/></a></div>
      </section>
    </div>

    <div className="attention-canonical-mobile">
      <section className="page-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h1>Τι χρειάζεται προσοχή</h1><p>Μία ντετερμινιστική λίστα ενεργειών από όσα γνωρίζει ήδη το MyFinHub. Δεν είναι οικονομική συμβουλή και δεν δημιουργεί κινήσεις χωρίς δική σου ενέργεια.</p></div><button type="button" className="secondary privacy-toggle" aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>} {visible?'Απόκρυψη ποσών':'Εμφάνιση ποσών'}</button></section>
      <section className="attention-summary-grid" aria-label="Σύνοψη εκκρεμοτήτων"><article className="neo-raised danger"><AlertTriangle/><div><span>Άμεση προσοχή</span><b>{items.filter(item=>item.severity==='danger').length}</b><small>Δεν κρύβονται μόνιμα όσο παραμένουν επείγουσες.</small></div></article><article className="neo-raised warning"><Clock3/><div><span>Σύντομα</span><b>{items.filter(item=>item.severity==='warning').length}</b><small>Υποχρεώσεις ή όρια που πλησιάζουν.</small></div></article><article className="neo-raised info"><BellRing/><div><span>Ενημέρωση</span><b>{items.filter(item=>item.severity==='info').length}</b><small>Γνωστές επόμενες ενέργειες χαμηλότερης προτεραιότητας.</small></div></article></section>
      {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}
      <section className="panel neo-raised attention-list-panel"><div className="panel-head"><div><span>Ενεργές εκκρεμότητες</span><small>Ταξινομημένες πρώτα κατά σοβαρότητα και μετά κατά ημερομηνία.</small></div><ListChecks size={18}/></div>{items.length?<div className="attention-list" role="list">{items.map(item=><article role="listitem" className={`attention-row ${item.severity}`} data-attention-id={item.id} key={item.id}><span className="attention-severity-icon" aria-hidden="true"><SeverityIcon severity={item.severity}/></span><div className="attention-copy"><div className="attention-title-line"><span className={`attention-badge ${item.severity}`}>{severityLabel(item.severity)}</span><b className={!visible&&(item.kind==='lending'||item.kind==='credit')?'private-text':''}>{item.title}</b></div><p>{item.reason}</p><div className="attention-meta">{item.dueDate?<span><CalendarClock size={14}/> {shortDate(item.dueDate)}</span>:null}{item.amount!==undefined?<span><AnimatedAmount value={item.amount} hidden={!visible}/></span>:null}</div></div><div className="attention-actions"><button type="button" className="save-button compact" onClick={()=>onAction(item)}>{actionLabel(item)}</button><Tooltip label="Προσωρινή αναβολή" side="left"><button type="button" aria-label={`Αναβολή ${item.title}`} onClick={()=>decide(item,'snooze')}><Clock3/></button></Tooltip>{item.severity!=='danger'?<Tooltip label="Απόκρυψη όσο δεν αλλάζει η κατάσταση" side="left"><button type="button" aria-label={`Απόκρυψη ${item.title}`} onClick={()=>decide(item,'dismiss')}><XCircle/></button></Tooltip>:null}</div></article>)}</div>:<div className="attention-empty"><CheckCircle2/><div><b>Δεν υπάρχει κάτι που χρειάζεται άμεση ενέργεια.</b><span>Το MyFinHub θα εμφανίσει εδώ γνωστές υποχρεώσεις, budgets που πλησιάζουν το όριό τους ή προβλεπόμενα χαμηλά υπόλοιπα όταν προκύψουν από τα δεδομένα σου.</span></div></div>}</section>
      <section className="forecast-assumption-note"><b>Πώς λειτουργεί:</b> η λίστα βασίζεται μόνο σε αποθηκευμένες ημερομηνίες, πραγματικές οφειλές/όρια, δηλωμένα budgets και τη ντετερμινιστική προβολή 30 ημερών. Δανεικά εμφανίζονται ως ληξιπρόθεσμα μόνο αν έχεις ορίσει ρητή αναμενόμενη ημερομηνία επιστροφής.</section>
    </div>
  </div>;
}
