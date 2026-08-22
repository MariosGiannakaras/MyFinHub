import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ContextualQuickAdd, type QuickActionContext } from './components/ContextualQuickAdd';
import { accountBalances } from './lib/domain';
import { qaFinanceData } from './qaFixture';
import type { FinanceEvent } from './types';
import './styles.css';

const data=qaFinanceData();
const asOf='2026-08-17';
const params=new URLSearchParams(location.search);
const target=params.get('target');
const context:QuickActionContext=target==='missing-recurring'
  ?{token:'payment-flow-qa-missing-recurring',mode:'recurring',recurringId:'qa-missing-recurring'}
  :{token:'payment-flow-qa-missing-loan',mode:'loan',loanId:'qa-missing-loan'};

function PaymentFlowHarness(){
  const [open,setOpen]=useState(true);
  const [created,setCreated]=useState<FinanceEvent|null>(null);
  return <main id="payment-flow-qa-harness">
    <div data-created-event={created?.id??''}/>
    <ContextualQuickAdd
      open={open}
      data={data}
      asOf={asOf}
      context={context}
      motionMode="reduced"
      onClose={()=>setOpen(false)}
      onCreate={event=>setCreated(event)}
      currentBalance={accountId=>accountBalances(data,asOf)[accountId]||0}
    />
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><PaymentFlowHarness/></StrictMode>);
