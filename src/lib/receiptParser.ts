import type { ReceiptProposal } from './receiptDrafts.js';

const TOTAL_WORDS = ['συνολο','πληρωτεο','τελικο','γενικο συνολο','total','grand total','amount due','payable'];
const BAD_TOTAL_WORDS = ['μερικο','υποσυνολο','subtotal','ρεστα','change','μετρητα','cash','φπα','vat','tax'];
const MERCHANT_NOISE = ['αποδειξη','λιανικης','receipt','ευχαριστ','thank you','τηλ','tel','αφμ','vat','δ.ο.υ','doy','ημερομηνια','date','ωρα','time'];

const fold = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('el-GR')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeSpaces = (value = '') => value.replace(/[\t\u00a0]+/g, ' ').replace(/\s+/g, ' ').trim();

function normalizeDate(day: number, month: number, year: number) {
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < 2000 || fullYear > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(fullYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateCandidate(line: string) {
  const match = line.match(/(?:^|\D)([0-3]?\d)[./-]([01]?\d)[./-](\d{2,4})(?:\D|$)/);
  if (!match) return undefined;
  return normalizeDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function parseMoneyToken(token: string) {
  let value = token.replace(/\s/g, '');
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  const decimalIndex = Math.max(comma, dot);
  if (decimalIndex >= 0 && value.length - decimalIndex - 1 === 2) {
    const integer = value.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimal = value.slice(decimalIndex + 1);
    value = `${integer}.${decimal}`;
  } else {
    value = value.replace(/[.,]/g, '');
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 && numeric < 100000 ? numeric : undefined;
}

type AmountCandidate = { amount: number; score: number; lineIndex: number; keyword: boolean };

function amountCandidates(lines: string[]): AmountCandidate[] {
  const rows: AmountCandidate[] = [];
  lines.forEach((line, lineIndex) => {
    const key = fold(line);
    const good = TOTAL_WORDS.some((word) => key.includes(word));
    const bad = BAD_TOTAL_WORDS.some((word) => key.includes(word));
    const tokens = [...line.matchAll(/(?:^|[^\d])((?:\d{1,3}(?:[.\s]\d{3})*|\d+)[,.]\d{2})(?!\d)/g)];
    for (const token of tokens) {
      const amount = parseMoneyToken(token[1] ?? '');
      if (!amount) continue;
      const relative = lines.length > 1 ? lineIndex / (lines.length - 1) : 0;
      let score = 0.35 + relative * 0.18;
      if (good) score += 0.52;
      if (bad) score -= 0.32;
      if (/[€]|\bEUR\b/i.test(line)) score += 0.08;
      rows.push({ amount, score, lineIndex, keyword: good });
    }
  });
  return rows.sort((a, b) => b.score - a.score || b.lineIndex - a.lineIndex || b.amount - a.amount);
}

function merchantCandidate(lines: string[]) {
  const top = lines.slice(0, Math.min(lines.length, 10));
  const candidates = top.map((line, index) => {
    const clean = normalizeSpaces(line).replace(/\b(?:ΑΦΜ|VAT)\b.*$/i, '').trim();
    const key = fold(clean);
    const letters = (clean.match(/\p{L}/gu) ?? []).length;
    const digits = (clean.match(/\d/g) ?? []).length;
    const noise = MERCHANT_NOISE.some((word) => key.includes(word));
    const hasDate = Boolean(dateCandidate(clean));
    let score = 0;
    if (letters >= 4) score += 0.45;
    if (clean.length >= 4 && clean.length <= 55) score += 0.2;
    if (letters > digits * 2) score += 0.18;
    score += Math.max(0, 0.15 - index * 0.018);
    if (noise || hasDate) score -= 0.55;
    if (/^[\d\W]+$/.test(clean)) score -= 0.6;
    return { clean, score };
  }).filter((row) => row.clean && row.score > 0.35).sort((a, b) => b.score - a.score);
  return candidates[0];
}

function detectedCurrency(text: string) {
  if (/[€]|\bEUR\b/i.test(text)) return 'EUR';
  if (/[$]|\bUSD\b/i.test(text)) return 'USD';
  if (/[£]|\bGBP\b/i.test(text)) return 'GBP';
  return undefined;
}

const ITEM_EXCLUSION_WORDS=[
  ...TOTAL_WORDS,...BAD_TOTAL_WORDS,'αφμ','παραστατικο','παραγγελια','πιστωτικη','καρτα',
  'card','visa','mastercard','pos','εκπτωση','discount','συναλλαγη','transaction',
  'barcode','tax','ημερομηνια','date','τηλεφωνο','tel','credit','payment'
];

function receiptItemCandidates(lines:string[],grandTotal:number|undefined,confidence:number){
  const items:NonNullable<ReceiptProposal['items']>=[];
  const grandCents=grandTotal===undefined?undefined:Math.round(grandTotal*100);
  for(const [index,line] of lines.entries()){
    if(items.length>=40)break;
    const key=fold(line);
    if(ITEM_EXCLUSION_WORDS.some(word=>key.includes(word))||dateCandidate(line))continue;
    // Final amount is a line total already printed by the till. Never multiply
    // an OCR-recognized quantity or invent a per-unit price.
    const match=line.match(/^(.+?)\s+((?:\d{1,3}(?:[.\s]\d{3})*|\d+)[,.]\d{2})\s*(?:€|EUR)?$/i);
    if(!match)continue;
    const description=normalizeSpaces(match[1]??'');
    if(description.length<2||description.length>90||(description.match(/\p{L}/gu)??[]).length<2)continue;
    const amount=parseMoneyToken(match[2]??'');
    if(amount===undefined)continue;
    const cents=Math.round(amount*100);
    if(!Number.isSafeInteger(cents)||cents<=0||(grandCents!==undefined&&cents>grandCents))continue;
    items.push({id:`ocr-line-${index+1}`,description,amount:cents/100,
      confidence:Math.max(.3,Math.min(.92,.45+confidence*.4))});
  }
  return items;
}

export function parseReceiptText(text: string, ocrConfidence = 0): ReceiptProposal {
  const lines = text.split(/\r?\n/).map(normalizeSpaces).filter(Boolean);
  const merchant = merchantCandidate(lines);
  const amount = amountCandidates(lines)[0];
  const dateRow = lines.map((line, index) => ({ date: dateCandidate(line), index })).find((row) => row.date);
  const currency = detectedCurrency(text);
  const normalizedOcr = Math.max(0, Math.min(1, ocrConfidence > 1 ? ocrConfidence / 100 : ocrConfidence));
  const proposal: ReceiptProposal = { confidence: { ocr: normalizedOcr } };
  if (merchant) {
    proposal.merchant = merchant.clean;
    proposal.confidence!.merchant = Math.max(0.45, Math.min(0.9, merchant.score * (0.75 + normalizedOcr * 0.25)));
  }
  if (dateRow?.date) {
    proposal.date = dateRow.date;
    proposal.confidence!.date = Math.max(0.55, Math.min(0.94, 0.72 + normalizedOcr * 0.22));
  }
  if (amount) {
    proposal.total = amount.amount;
    proposal.confidence!.total = Math.max(0.5, Math.min(0.98, amount.score * (0.8 + normalizedOcr * 0.2)));
  }
  if (currency) {
    proposal.currency = currency;
    proposal.confidence!.currency = 0.96;
  }
  const items=receiptItemCandidates(lines,proposal.total,normalizedOcr);
  if(items.length){
    proposal.items=items;
    proposal.itemsCurrency=currency;
    if(proposal.total!==undefined){
      const totalCents=items.reduce((sum,item)=>sum+Math.round(item.amount*100),0);
      proposal.itemsBalanced=totalCents===Math.round(proposal.total*100);
    }
  }
  return proposal;
}

export { suggestReceiptCategory } from './reviewedMerchantSignals.js';
