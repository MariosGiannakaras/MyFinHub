import { ReceiptText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteReceiptDraft, type ReceiptProposal } from '../lib/receiptDrafts';
import type { FinanceData, FinanceEvent, EventKind } from '../types';
import { QuickAdd, type QuickPrefill } from './QuickAdd';
import { ReceiptInbox } from './ReceiptInbox';

export function ReceiptAwareQuickAdd({
  open,
  data,
  asOf,
  initial,
  initialKind = 'expense',
  prefill = null,
  motionMode = 'system',
  onClose,
  onCreate,
  currentBalance,
}: {
  open: boolean;
  data: FinanceData;
  asOf: string;
  initial?: FinanceEvent | null;
  initialKind?: EventKind;
  prefill?: QuickPrefill | null;
  motionMode?: 'system' | 'reduced' | 'full';
  onClose: () => void;
  onCreate: (event: FinanceEvent) => void;
  currentBalance: (accountId: string) => number;
}) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptDraftId, setReceiptDraftId] = useState<string | null>(null);
  const [receiptProposal, setReceiptProposal] = useState<ReceiptProposal | null>(null);
  const [receiptSession, setReceiptSession] = useState(0);
  const [receiptHost, setReceiptHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setReceiptOpen(false);
      setReceiptDraftId(null);
      setReceiptProposal(null);
      setReceiptHost(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || receiptOpen || initial) {
      setReceiptHost(null);
      return;
    }
    setReceiptHost(document.querySelector<HTMLElement>('[aria-labelledby="quick-add-title"] > footer'));
    return () => setReceiptHost(null);
  }, [open, receiptOpen, initial, receiptSession]);

  const receiptPrefill = useMemo<QuickPrefill | null>(() => {
    if (!receiptDraftId) return null;
    const explicitNonEur = Boolean(receiptProposal?.currency && receiptProposal.currency !== 'EUR');
    return {
      note: receiptProposal?.merchant ?? '',
      amount: explicitNonEur ? 0 : (receiptProposal?.total ?? 0),
      category: receiptProposal?.category,
    };
  }, [receiptDraftId, receiptProposal]);

  const applyReceipt = (draftId: string, proposal: ReceiptProposal) => {
    setReceiptDraftId(draftId);
    setReceiptProposal(proposal);
    setReceiptOpen(false);
    setReceiptSession((value) => value + 1);
  };

  const create = (event: FinanceEvent) => {
    onCreate(event);
    if (receiptDraftId) {
      const handledId = receiptDraftId;
      setReceiptDraftId(null);
      setReceiptProposal(null);
      void deleteReceiptDraft(handledId);
    }
  };

  if (!open) return null;

  return <>
    {!receiptOpen ? <>
      <QuickAdd
        key={`quick-${receiptSession}`}
        open={open}
        data={data}
        asOf={receiptProposal?.date ?? asOf}
        initial={initial}
        initialKind={receiptDraftId ? 'expense' : initialKind}
        prefill={receiptDraftId ? receiptPrefill : prefill}
        motionMode={motionMode}
        onClose={onClose}
        onCreate={create}
        currentBalance={currentBalance}
      />
      {!initial && receiptHost ? createPortal(<button type="button" className="receipt-quick-launch neo-raised" aria-label="Φωτογράφιση ή σάρωση απόδειξης" onClick={() => setReceiptOpen(true)}><ReceiptText size={18}/><span>Απόδειξη</span></button>, receiptHost) : null}
    </> : null}
    <ReceiptInbox open={receiptOpen} data={data} onClose={() => setReceiptOpen(false)} onApply={applyReceipt}/>
  </>;
}
