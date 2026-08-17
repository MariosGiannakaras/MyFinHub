import { ArrowRight, PiggyBank, Wallet } from 'lucide-react';
import type { CSSProperties } from 'react';
import { accountBalances, monthlyFlow } from '../lib/domain';
import { money } from '../lib/format';
import type { FinanceData } from '../types';

export function SavingsPage({data,month,asOf,onQuickAdd}:{data:FinanceData;month:string;asOf:string;onQuickAdd:()=>void}){
 const balances=accountBalances(data,asOf); const flow=monthlyFlow(data,month); const target=data.state.settings.savingsTargetRate||.2; const rate=flow.income?flow.saving/flow.income:0;
 return <div className="page-stack"><section className="page-heading"><div><span className="eyebrow">SAVINGS LOGIC</span><h1>Αποταμίευση</h1><p>Ξεχωριστή έννοια από income, expense και απλή μεταφορά.</p></div><button className="save-button" onClick={onQuickAdd}><PiggyBank size={17}/> Νέα αποταμίευση</button></section><section className="savings-hero neo-raised"><div className="savings-gauge"><div className="gauge-ring" style={{'--progress':`${Math.min(100,rate/target*100)}%`} as CSSProperties}><div><b>{Math.round(rate*100)}%</b><span>των εσόδων</span></div></div></div><div><span className="eyebrow">ΑΥΤΟΣ Ο ΜΗΝΑΣ</span><h2>{money.format(flow.saving)}</h2><p>Στόχος: {Math.round(target*100)}% των πραγματικών εσόδων. Η αποταμίευση δεν αυξάνει/μειώνει το cash flow.</p><div className="saving-route"><span><Wallet/> Μισθοδοσίας <b>{money.format(balances['piraeus-payroll']||0)}</b></span><ArrowRight/><span><PiggyBank/> Ταμιευτηρίου <b>{money.format(balances['piraeus-savings']||0)}</b></span></div><div className="logic-note compact"><PiggyBank/><div><b>Μετρητά ως αντίκρισμα</b><span>Όταν κρατάς φυσικά μετρητά και μεταφέρεις ισόποσο ψηφιακό ποσό από Μισθοδοσίας σε Ταμιευτηρίου, το cash balance μένει ακριβώς ίδιο.</span></div></div></div></section></div>;
}
