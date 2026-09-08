from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def path(rel):
    return ROOT / rel

def replace(rel, old, new, expected=1):
    p = path(rel)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{rel}: expected {expected} occurrences, found {count}: {old[:120]!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')

def remove_line(rel, line):
    replace(rel, line, '', 1)

legacy_component = r'''import { Check, Clock3, Plus, ShieldCheck, Split, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { CategorySelectInput } from './CategorySelectInput';
import { MoneyInput } from './MoneyInput';
import { Tooltip } from './Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { reviewSuggestions, suggestSplitParts } from '../lib/domain';
import { cleanNote, money, shortDate } from '../lib/format';
import { accountDisplayName, reviewConfidenceLabel, reviewSemanticLabel } from '../lib/ui';
import type { FinanceData, ReviewDecision, SplitPart } from '../types';

export function LegacyConfirmationPanel({
  data,
  onDecision,
  idPrefix='legacy-confirmation',
}:{
  data:FinanceData;
  onDecision:(id:string,decision:ReviewDecision)=>void;
  idPrefix?:string;
}){
  const suggestions=reviewSuggestions(data).slice(0,120);
  const [splitTx,setSplitTx]=useState<string|null>(null);
  const active=suggestions.find(s=>s.transaction.id===splitTx);
  const [parts,setParts]=useState<SplitPart[]>([]);
  const modalRef=useModalFocus<HTMLElement>(Boolean(active),'input',()=>setSplitTx(null));
  const act=(id:string,status:ReviewDecision['status'],semanticKind?:ReviewDecision['semanticKind'])=>{
    const now=new Date();
    const snoozedUntil=status==='snoozed'?new Date(now.getTime()+24*60*60*1000).toISOString():undefined;
    onDecision(id,{status,semanticKind,decidedAt:now.toISOString(),snoozedUntil});
  };
  const openSplit=(id:string)=>{
    const suggestion=suggestions.find(item=>item.transaction.id===id);
    if(!suggestion)return;
    const parsed=suggestSplitParts(suggestion.transaction.note,suggestion.transaction.category||'Άλλο');
    setParts(parsed.length?parsed:[{id:'sp-1',label:'',category:suggestion.transaction.category||'Άλλο',amount:suggestion.transaction.amount,kind:'expense'}]);
    setSplitTx(id);
  };
  const splitSum=parts.reduce((sum,part)=>sum+part.amount,0);
  const splitValid=Boolean(parts.length)&&Math.abs(splitSum-(active?.transaction.amount??0))<.01&&parts.every(part=>Number.isFinite(part.amount)&&part.amount>0);
  const closeSplit=()=>setSplitTx(null);

  return <section className="attention-approved-group pending legacy-confirmation-panel" data-legacy-confirmation-panel aria-labelledby={`${idPrefix}-title`}>
    <header className="attention-approved-group-head">
      <div className="attention-approved-group-title">
        <span className="attention-approved-group-icon" aria-hidden="true"><ShieldCheck/></span>
        <div><h2 id={`${idPrefix}-title`}>Προς επιβεβαίωση ({suggestions.length})</h2><p>Παλαιότερες κινήσεις όπου το MyFinHub εντόπισε πιθανή διαφορετική σημασιολογία. Καμία αναφορά δεν αλλάζει χωρίς δική σου επιβεβαίωση.</p></div>
      </div>
      <span className="attention-approved-group-count" aria-label={`${suggestions.length} κινήσεις προς επιβεβαίωση`}>{suggestions.length}</span>
    </header>
    {suggestions.length?<div className="review-list legacy-confirmation-list" role="list" aria-label="Κινήσεις προς επιβεβαίωση">{suggestions.map(s=><article role="listitem" className="review-row legacy-confirmation-row" key={s.transaction.id}>
      <div className={`confidence-orb ${s.confidence}`} aria-label={reviewConfidenceLabel(s.confidence)}>{s.confidence==='high'?'Υψηλή':s.confidence==='medium'?'Μέτρια':'Χαμηλή'}</div>
      <div className="review-copy"><div className="review-meta"><span>{shortDate(s.transaction.date)}</span><em>{accountDisplayName(data,s.transaction.accountId)}</em><b>{money.format(s.transaction.amount)}</b></div><h3>{cleanNote(s.transaction.note).split('\n')[0]}</h3><p>{s.reason}</p><span className="suggestion-tag">{s.semanticKind==='split_required'?<Split size={14}/>:<ShieldCheck size={14}/>} Πρόταση: {reviewSemanticLabel(s.semanticKind)}</span></div>
      <div className="review-buttons">{s.semanticKind==='split_required'?<button type="button" className="approve" onClick={()=>openSplit(s.transaction.id)}><Split size={15}/> Άνοιγμα διαχωρισμού</button>:<button type="button" className="approve" disabled={s.semanticKind==='iris_context'} onClick={()=>act(s.transaction.id,'confirmed',s.semanticKind==='iris_context'?undefined:s.semanticKind)}><Check size={15}/> Επιβεβαίωση</button>}<button type="button" onClick={()=>act(s.transaction.id,'kept')}><Undo2 size={15}/> Κράτα ως είναι</button><button type="button" onClick={()=>act(s.transaction.id,'snoozed')}><Clock3 size={15}/> Αργότερα</button></div>
    </article>)}</div>:<div className="attention-approved-empty-row"><Check/><span>Δεν υπάρχουν κινήσεις που χρειάζονται δική σου επιβεβαίωση.</span></div>}
    {active?<div className="editor-backdrop" onMouseDown={closeSplit}><section ref={modalRef} className="panel neo-raised editor-dialog" role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-split-title`} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="panel-head"><div><span id={`${idPrefix}-split-title`}>Διαχωρισμός κίνησης</span><small>{cleanNote(active.transaction.note).replace(/\n/g,' · ')}</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας διαχωρισμού" onClick={closeSplit}><X/></button></div><div className="split-review-summary"><span>Αρχικό ποσό <b>{money.format(active.transaction.amount)}</b></span><span>Μέρη <b className={Math.abs(splitSum-active.transaction.amount)<.01?'positive':'negative'}>{money.format(splitSum)}</b></span></div>{parts.map((part,index)=><div className="review-part" key={part.id}><AppTextInput aria-label={`Περιγραφή μέρους ${index+1}`} value={part.label} onChange={event=>setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,label:event.target.value}:item))}/><AppSelectInput aria-label={`Τύπος μέρους ${index+1}`} value={part.kind||'expense'} onChange={event=>setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,kind:event.target.value as SplitPart['kind']}:item))}><option value="expense">Έξοδο</option><option value="income">Έσοδο</option><option value="refund">Επιστροφή αγοράς</option><option value="saving">Αποταμίευση</option><option value="transfer">Μεταφορά</option><option value="reconciliation">Διόρθωση</option></AppSelectInput><CategorySelectInput settings={data.state.settings} kind="expense" category={part.category} subcategory={part.subcategory} aria-label={`Κατηγορία ή υποκατηγορία μέρους ${index+1}`} onChange={selection=>setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,category:selection.category,subcategory:selection.subcategory||undefined}:item))}/><MoneyInput aria-label={`Ποσό μέρους ${index+1}`} value={Number.isFinite(part.amount)&&part.amount>0?String(part.amount):''} onValueChange={value=>{const numeric=Number(value.replace(',','.'));setParts(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,amount:Number.isFinite(numeric)?numeric:0}:item))}} invalid={!Number.isFinite(part.amount)||part.amount<=0}/><Tooltip label={`Αφαίρεση μέρους ${index+1}`} side="left"><button type="button" className="danger" aria-label={`Αφαίρεση μέρους ${index+1}`} onClick={()=>setParts(items=>items.filter((_,itemIndex)=>itemIndex!==index))}><Trash2/></button></Tooltip></div>)}{!splitValid?<div className="form-error" role="alert">Τα ποσά των μερών πρέπει να είναι θετικά και το άθροισμά τους να είναι ίσο με το αρχικό ποσό.</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={()=>setParts(items=>[...items,{id:`sp-${Date.now()}`,label:'',category:active.transaction.category||'Άλλο',amount:0,kind:'expense'}])}><Plus/> Προσθήκη μέρους</button><button type="button" className="save-button" disabled={!splitValid} onClick={()=>{onDecision(active.transaction.id,{status:'confirmed',semanticKind:'split',parts,decidedAt:new Date().toISOString()});closeSplit()}}><Check/> Επιβεβαίωση διαχωρισμού</button></div></section></div>:null}
  </section>;
}
'''
path('src/components/LegacyConfirmationPanel.tsx').write_text(legacy_component, encoding='utf-8')
path('src/pages/ReviewPage.tsx').unlink()

# App shell: one owner-facing review/action center only.
replace('src/components/AppShell.tsx',
"export type PageId = 'dashboard'|'transactions'|'review'|'savings'|'cards'|'credit'|'loans'|'lending'|'recurring'|'planning'|'attention'|'reports'|'settings';",
"export type PageId = 'dashboard'|'transactions'|'savings'|'cards'|'credit'|'loans'|'lending'|'recurring'|'planning'|'attention'|'reports'|'settings';")
replace('src/components/AppShell.tsx', "{id:'attention',label:'Χρειάζεται προσοχή',icon:<BellRing size={18}/>}", "{id:'attention',label:'Έλεγχος',icon:<BellRing size={18}/>}")

# Production routing keeps only attention, with a compatibility redirect for old bookmarks.
remove_line('src/App.tsx', "const ReviewPage = lazy(() => import('./pages/ReviewPage').then((module) => ({ default: module.ReviewPage })));\n")
replace('src/App.tsx',
"const PAGE_IDS: PageId[] = ['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];",
"const PAGE_IDS: PageId[] = ['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];")
replace('src/App.tsx',
"  if (!raw) return { page: 'dashboard' as PageId, notFound: false };\n  if (PAGE_IDS.includes(raw as PageId)) return { page: raw as PageId, notFound: false };",
"  if (!raw) return { page: 'dashboard' as PageId, notFound: false };\n  if (raw === 'review') { history.replaceState(null, '', '#/attention'); return { page: 'attention' as PageId, notFound: false }; }\n  if (PAGE_IDS.includes(raw as PageId)) return { page: raw as PageId, notFound: false };")
remove_line('src/App.tsx', "    : page === 'review' ? <ReviewPage data={data} onDecision={decide}/>\n")
replace('src/App.tsx',
"    : page === 'attention' ? <AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention}/>",
"    : page === 'attention' ? <AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention} onReviewDecision={decide}/>")

# Consolidated page content and naming.
replace('src/pages/AttentionPage.tsx', "import { AnimatedAmount } from '../components/AnimatedAmount';\n", "import { AnimatedAmount } from '../components/AnimatedAmount';\nimport { LegacyConfirmationPanel } from '../components/LegacyConfirmationPanel';\n")
replace('src/pages/AttentionPage.tsx', "import type { AttentionDecision, FinanceData } from '../types';", "import type { AttentionDecision, FinanceData, ReviewDecision } from '../types';")
replace('src/pages/AttentionPage.tsx',
"export function AttentionPage({data,asOf,onAction,onDecision}:{data:FinanceData;asOf:string;onAction:(item:AttentionItem)=>void;onDecision:(id:string,decision:AttentionDecision)=>void}){",
"export function AttentionPage({data,asOf,onAction,onDecision,onReviewDecision}:{data:FinanceData;asOf:string;onAction:(item:AttentionItem)=>void;onDecision:(id:string,decision:AttentionDecision)=>void;onReviewDecision:(id:string,decision:ReviewDecision)=>void}){")
replace('src/pages/AttentionPage.tsx', "<div><h1>Τι χρειάζεται προσοχή</h1><p>Σημεία που απαιτούν την προσοχή σου για τα οικονομικά σου.</p></div>", "<div><h1>Έλεγχος</h1><p>Ό,τι χρειάζεται τη ματιά ή την απόφασή σου για τα οικονομικά σου.</p></div>")
replace('src/pages/AttentionPage.tsx',
"      <ApprovedGroup title=\"Εκκρεμότητες\" subtitle=\"Γνωστές ενέργειες χαμηλότερης προτεραιότητας που παραμένουν ενεργές.\" tone=\"pending\" items={groups.pending} visible={visible} asOf={asOf} onAction={onAction} onSnooze={item=>decide(item,'snooze')} onDismiss={item=>decide(item,'dismiss')} emptyText=\"Δεν υπάρχουν άλλες ενεργές εκκρεμότητες.\"/>\n      <ApprovedGroup title=\"Ενημερώσεις\"",
"      <ApprovedGroup title=\"Εκκρεμότητες\" subtitle=\"Γνωστές ενέργειες χαμηλότερης προτεραιότητας που παραμένουν ενεργές.\" tone=\"pending\" items={groups.pending} visible={visible} asOf={asOf} onAction={onAction} onSnooze={item=>decide(item,'snooze')} onDismiss={item=>decide(item,'dismiss')} emptyText=\"Δεν υπάρχουν άλλες ενεργές εκκρεμότητες.\"/>\n      <LegacyConfirmationPanel data={data} onDecision={onReviewDecision} idPrefix=\"desktop-confirmation\"/>\n      <ApprovedGroup title=\"Ενημερώσεις\"")
replace('src/pages/AttentionPage.tsx',
"<section className=\"page-heading\"><div><span className=\"eyebrow\">NEEDS ATTENTION</span><h1>Τι χρειάζεται προσοχή</h1><p>Μία ντετερμινιστική λίστα ενεργειών από όσα γνωρίζει ήδη το MyFinHub. Δεν είναι οικονομική συμβουλή και δεν δημιουργεί κινήσεις χωρίς δική σου ενέργεια.</p></div>",
"<section className=\"page-heading\"><div><span className=\"eyebrow\">ΕΛΕΓΧΟΣ</span><h1>Έλεγχος</h1><p>Εκκρεμότητες και κινήσεις που χρειάζονται τη δική σου ματιά. Το MyFinHub δεν αλλάζει οικονομικά δεδομένα χωρίς δική σου ενέργεια.</p></div>")
replace('src/pages/AttentionPage.tsx',
"      <section className=\"forecast-assumption-note\"><b>Πώς λειτουργεί:</b>",
"      <LegacyConfirmationPanel data={data} onDecision={onReviewDecision} idPrefix=\"mobile-confirmation\"/>\n      <section className=\"forecast-assumption-note\"><b>Πώς λειτουργεί:</b>")

# Loading skeleton and QA route registry no longer model Review as a separate surface.
replace('src/components/AppSkeleton.tsx', "function ReviewSkeleton(){return <div className=\"skeleton-page-stack\"><Heading actions={0}/><MetricGrid count={3}/><Panel button><Rows count={5}/></Panel></div>}\n", '')
remove_line('src/components/AppSkeleton.tsx', "  if(page==='review')return <ReviewSkeleton/>;\n")
replace('src/components/AppSkeleton.tsx',
"  if(hash)return hash;\n  const query=new URLSearchParams(location.search).get('page');\n  return query||'dashboard';",
"  if(hash)return hash==='review'?'attention':hash;\n  const query=new URLSearchParams(location.search).get('page');\n  return query==='review'?'attention':query||'dashboard';")

remove_line('src/qa.tsx', "import { ReviewPage } from './pages/ReviewPage';\n")
replace('src/qa.tsx',
"const QA_PAGES:PageId[]=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];",
"const QA_PAGES:PageId[]=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];")
replace('src/qa.tsx',
"const QA_PAGE_HEADINGS:Record<PageId,string>={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Τι χρειάζεται προσοχή',reports:'Αναφορές · Η οικονομική εικόνα του μήνα',settings:'Ρυθμίσεις'};",
"const QA_PAGE_HEADINGS:Record<PageId,string>={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές · Η οικονομική εικόνα του μήνα',settings:'Ρυθμίσεις'};")
replace('src/qa.tsx', "function initialPage(raw:string|null):PageId{return QA_PAGES.includes(raw as PageId)?raw as PageId:'dashboard'}", "function initialPage(raw:string|null):PageId{if(raw==='review')return 'attention';return QA_PAGES.includes(raw as PageId)?raw as PageId:'dashboard'}")
remove_line('src/qa.tsx', "    :page==='review'?<ReviewPage data={data} onDecision={(id,decision)=>update(current=>({...current,state:{...current.state,reviewDecisions:{...(current.state.reviewDecisions??{}),[id]:decision}}}))}/>\n")
replace('src/qa.tsx',
"    :page==='attention'?<AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention}/>",
"    :page==='attention'?<AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention} onReviewDecision={(id,decision)=>update(current=>({...current,state:{...current.state,reviewDecisions:{...(current.state.reviewDecisions??{}),[id]:decision}}}))}/>")

# Command palette exposes one canonical destination.
replace('src/lib/commandSearch.ts',
"export type CommandPage='dashboard'|'transactions'|'review'|'savings'|'cards'|'credit'|'loans'|'lending'|'recurring'|'planning'|'attention'|'reports'|'settings';",
"export type CommandPage='dashboard'|'transactions'|'savings'|'cards'|'credit'|'loans'|'lending'|'recurring'|'planning'|'attention'|'reports'|'settings';")
replace('src/lib/commandSearch.ts',
"['attention','Χρειάζεται προσοχή','Ενεργές οικονομικές εκκρεμότητες',39],['reports','Αναφορές','Αναλύσεις, budgets και τάσεις',40],['review','Έλεγχος παλιών κινήσεων','Review εισαγμένων κινήσεων',41],['settings','Ρυθμίσεις','Budgets, κανόνες και προτιμήσεις',42],",
"['attention','Έλεγχος','Εκκρεμότητες και κινήσεις προς επιβεβαίωση',39],['reports','Αναφορές','Αναλύσεις, budgets και τάσεις',40],['settings','Ρυθμίσεις','Budgets, κανόνες και προτιμήσεις',42],")

# Performance/rendered matrices remove the standalone page while preserving the unified action center.
remove_line('vite.performance.config.ts', "  'ReviewPage',\n")
replace('scripts/loading-shift-audit.mjs', "const pages=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];", "const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];")
replace('tests/skeleton-fidelity.test.ts', "const routes=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];", "const routes=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];")
replace('tests/release-readiness-source.test.ts', "const pages=['dashboard','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings']", "const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings']")

replace('scripts/ui-ux-runtime-qa.mjs',
"const PAGE_HEADINGS={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',reports:'Αναφορές',settings:'Ρυθμίσεις'};",
"const PAGE_HEADINGS={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'};")
replace('scripts/ui-ux-visual-evidence-qa.mjs',
"const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',reports:'Αναφορές',settings:'Ρυθμίσεις'};",
"const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'};")
replace('scripts/theme-system-qa.mjs',
"const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Τι χρειάζεται προσοχή',reports:'Αναφορές',settings:'Ρυθμίσεις'};",
"const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'};")
replace('scripts/ui-ux-hardening-qa.mjs', "review:'Έλεγχος παλιών κινήσεων',", '', 1)
replace('scripts/ui-ux-hardening-qa.mjs', "attention:'Τι χρειάζεται προσοχή'", "attention:'Έλεγχος'", 1)
replace('scripts/action-center-context-qa.mjs', "includes('Τι χρειάζεται προσοχή')", "includes('Έλεγχος')", 1)
replace('scripts/action-center-context-qa.mjs',
"  assert((await c.call(\"function(){return document.querySelectorAll('.attention-row').length}\"))>0,'attention queue has actionable items');",
"  assert((await c.call(\"function(){return document.querySelectorAll('.attention-row').length}\"))>0,'attention queue has actionable items');\n  assert(await c.call(\"function(){return Boolean(document.querySelector('[data-legacy-confirmation-panel]'))}\"),'legacy confirmation is integrated into Έλεγχος');")

# Product docs present one unified owner-facing concept; persisted/internal review semantics remain named for compatibility.
replace('README.md',
"- **Needs Attention:** one action center for finance items that require review or follow-up.\n- **Review:** controlled proposals that do not affect reports until confirmed.",
"- **Έλεγχος:** one action center for finance items that require follow-up or explicit confirmation, including legacy semantic candidates.")
replace('README.md', "- **Smart Review:** proposals affect reports only after confirmation.", "- **Legacy confirmation:** suggested reinterpretations affect reports only after explicit confirmation.")

status = path('docs/ui-redesign/REDESIGN_STATUS.md').read_text(encoding='utf-8')
old_rows = "| 11 | Needs Attention | DESIGN APPROVED | VERIFIED | merged to `develop` via #339 |\n| 12 | Review | NOT STARTED | NOT STARTED | — |\n| 13 | Reports | DESIGN APPROVED | VERIFIED | merged to `develop` via #342 |\n| 14 | Settings | DESIGN APPROVED | VERIFIED | Data owner-approved and merged to `develop` via #354 |"
new_rows = "| 11 | Έλεγχος | DESIGN APPROVED | VALIDATING | owner-approved Needs Attention baseline via #339; Review consolidation tracked by #355 |\n| 12 | Reports | DESIGN APPROVED | VERIFIED | merged to `develop` via #342 |\n| 13 | Settings | DESIGN APPROVED | VERIFIED | Data owner-approved and merged to `develop` via #354 |"
if status.count(old_rows) != 1:
    raise RuntimeError('REDESIGN_STATUS rows did not match expected current state')
status = status.replace(old_rows, new_rows)
marker = "\n## Protected exclusion\n"
note = "\n## Έλεγχος consolidation\n\nThe owner approved consolidating the former standalone Review concept into the already verified Needs Attention action center under the single owner-facing name **Έλεγχος**. Issue #355 removes Review as a separate route/surface, keeps the useful legacy semantic-confirmation workflow as a distinct **Προς επιβεβαίωση** section, and preserves compatibility-critical `reviewDecisions` plus the advisory confirmation semantics. The existing Needs Attention presentation remains the visual baseline while this consolidation is validated.\n"
if status.count(marker) != 1:
    raise RuntimeError('REDESIGN_STATUS protected-exclusion marker missing')
status = status.replace(marker, note + marker)
path('docs/ui-redesign/REDESIGN_STATUS.md').write_text(status, encoding='utf-8')

source_test = r'''import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Review consolidation into Έλεγχος',()=>{
  it('exposes one canonical owner-facing review/action surface',()=>{
    const shell=read('src/components/AppShell.tsx');
    const app=read('src/App.tsx');
    const commands=read('src/lib/commandSearch.ts');
    expect(shell).toContain("{id:'attention',label:'Έλεγχος'");
    expect(shell).not.toContain("|'review'|");
    expect(app).not.toContain('ReviewPage');
    expect(app).toContain("raw === 'review'");
    expect(app).toContain("page: 'attention' as PageId");
    expect(app).toContain('onReviewDecision={decide}');
    expect(commands).not.toContain("['review','Έλεγχος παλιών κινήσεων'");
    expect(commands).toContain("['attention','Έλεγχος','Εκκρεμότητες και κινήσεις προς επιβεβαίωση'");
    expect(fs.existsSync(path.join(root,'src/pages/ReviewPage.tsx'))).toBe(false);
  });

  it('keeps legacy confirmation behavior inside Έλεγχος without changing reports implicitly',()=>{
    const attention=read('src/pages/AttentionPage.tsx');
    const confirmation=read('src/components/LegacyConfirmationPanel.tsx');
    expect(attention).toContain('<h1>Έλεγχος</h1>');
    expect(attention).toContain('<LegacyConfirmationPanel');
    expect(confirmation).toContain('reviewSuggestions(data)');
    expect(confirmation).toContain('Καμία αναφορά δεν αλλάζει χωρίς δική σου επιβεβαίωση.');
    expect(confirmation).toContain('Κράτα ως είναι');
    expect(confirmation).toContain('Αργότερα');
    expect(confirmation).toContain("semanticKind:'split'");
    expect(confirmation).toContain("Math.abs(splitSum-(active?.transaction.amount??0))<.01");
  });
});
'''
path('tests/review-consolidation-source.test.ts').write_text(source_test, encoding='utf-8')

print('Review consolidation patch applied successfully.')
