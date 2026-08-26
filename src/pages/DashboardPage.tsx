import { useMemo, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Eye,
  EyeOff,
  List,
  MoreHorizontal,
  PiggyBank,
  Repeat2,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AccountIban } from '../components/AccountIban';
import { BankBrandMark } from '../components/BankBrandMark';
import { FinanceIcon } from '../components/FinanceIcon';
import type { QuickPrefill } from '../components/QuickAdd';
import {
  allAccounts,
  effectiveLegacyTransactions,
  flowImpactEvent,
  flowImpactLegacy,
  monthRange,
} from '../lib/domain';
import { compactMoney, money, shortDate } from '../lib/format';
import { pendingScheduled } from '../lib/scheduled';
import {
  selectAccountBalances,
  selectCategoryTotals,
  selectFrequentDescriptions,
  selectMonthlyFlow,
} from '../lib/selectors';
import { accountDisplayName, effectiveRecurringItems } from '../lib/ui';
import type { FinanceData } from '../types';
import '../styles/part48.css';

const PRIMARY_ACCOUNTS=['cash','piraeus-payroll','piraeus-savings'];
const chartColors = ['#39c77b', '#438ff1', '#ffb52e', '#a45de7', '#d95cc5', '#98a5b7'];

type DashboardProps = {
  data: FinanceData;
  month: string;
  asOf: string;
  motionMode?: 'system' | 'reduced' | 'full';
  onQuickAdd: (prefill?: QuickPrefill) => void;
  onAccountQuickAdd: (accountId: string, kind: string) => void;
  onTransactions: () => void;
  onPlanning: () => void;
  onAttention: () => void;
  onReports: () => void;
};

type MonthRow = {
  id: string;
  date: string;
  note: string;
  category: string;
  amount: number;
  kind: string;
};

function shiftMonth(month: string, delta: number) {
  const [year, rawMonth] = month.split('-').map(Number);
  const value = new Date(Date.UTC(year, rawMonth - 1 + delta, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function previousMonthEnd(month: string) {
  return monthRange(shiftMonth(month, -1)).end;
}

function percentChange(current: number, previous: number) {
  if (Math.abs(previous) < 0.01) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trendCopy(change: number | null) {
  if (change === null) return 'χωρίς συγκρίσιμη βάση';
  return `${Math.abs(Math.round(change))}% από προηγ.`;
}

function eventLabel(kind: string) {
  const labels: Record<string, string> = {
    expense: 'Έξοδο',
    income: 'Έσοδο',
    transfer: 'Μεταφορά',
    saving_cash_offset: 'Αποταμίευση',
    withdrawal: 'Ανάληψη',
    refund: 'Επιστροφή',
    lending: 'Δανεικά',
    repayment: 'Επιστροφή οφειλής',
    card_purchase: 'Αγορά κάρτας',
    card_payment: 'Πληρωμή κάρτας',
    reconciliation: 'Συμφωνία',
    split: 'Επιμερισμός',
  };
  return labels[kind] ?? 'Συναλλαγή';
}

function buildMonthRows(data: FinanceData, month: string): MonthRow[] {
  const { start, end } = monthRange(month);
  const legacy = effectiveLegacyTransactions(data)
    .filter((item) => item.date >= start && item.date <= end)
    .map((item): MonthRow => {
      const impact = flowImpactLegacy(data, item);
      const amount =
        impact.income > 0
          ? impact.income
          : impact.refund > 0
            ? impact.refund
            : impact.expense > 0
              ? -impact.expense
              : impact.saving > 0
                ? -impact.saving
                : item.type === 'expense'
                  ? -item.amount
                  : item.type === 'income'
                    ? item.amount
                    : 0;
      return {
        id: `legacy-${item.id}`,
        date: item.date,
        note: item.note || 'Συναλλαγή',
        category: item.category || (item.type === 'transfer' ? 'Μεταφορά' : 'Άλλο'),
        amount,
        kind: item.type,
      };
    });

  const events = (data.state.events ?? [])
    .filter((item) => item.date >= start && item.date <= end)
    .map((item): MonthRow => {
      const impact = flowImpactEvent(item);
      const amount =
        impact.income > 0
          ? impact.income
          : impact.refund > 0
            ? impact.refund
            : impact.expense > 0
              ? -impact.expense
              : impact.saving > 0
                ? -impact.saving
                : item.kind === 'expense' || item.kind === 'card_purchase'
                  ? -item.amount
                  : item.kind === 'income' || item.kind === 'refund'
                    ? item.amount
                    : 0;
      return {
        id: `event-${item.id}`,
        date: item.date,
        note: item.note || eventLabel(item.kind),
        category: item.category || eventLabel(item.kind),
        amount,
        kind: item.kind,
      };
    });

  return [...legacy, ...events].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function buildDailyFlow(data: FinanceData, month: string) {
  const { end } = monthRange(month);
  const days = Number(end.slice(-2));
  const rows = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    income: 0,
    expense: 0,
  }));
  const byDay = new Map(rows.map((row) => [row.day, row]));

  for (const transaction of effectiveLegacyTransactions(data)) {
    if (!transaction.date.startsWith(`${month}-`)) continue;
    const row = byDay.get(Number(transaction.date.slice(-2)));
    if (!row) continue;
    const impact = flowImpactLegacy(data, transaction);
    row.income += impact.income;
    row.expense += impact.expense;
  }

  for (const event of data.state.events ?? []) {
    if (!event.date.startsWith(`${month}-`)) continue;
    const row = byDay.get(Number(event.date.slice(-2)));
    if (!row) continue;
    const impact = flowImpactEvent(event);
    row.income += impact.income;
    row.expense += impact.expense;
  }

  return rows.map((row) => ({
    ...row,
    expense: Math.max(0, row.expense),
  }));
}

function buildBalanceSeries(data: FinanceData, accountId: string, month: string, asOf: string) {
  const { end } = monthRange(month);
  const monthIsCurrent = asOf.startsWith(`${month}-`);
  const cutoff = monthIsCurrent && asOf < end ? asOf : end;
  const days = Math.max(1, Number(cutoff.slice(-2)));
  return Array.from({ length: days }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    return { day: index + 1, value: selectAccountBalances(data, date)[accountId] ?? 0 };
  });
}

function toneForAccount(kind: string) {
  if (kind === 'cash') return 'green';
  if (kind === 'savings') return 'blue';
  return 'violet';
}

function MonthListIcon({ row }: { row: MonthRow }) {
  return (
    <span className="dashboard-list-icon" aria-hidden="true">
      <FinanceIcon kind={row.kind} note={row.note} category={row.category} size={16} />
    </span>
  );
}

export function DashboardPage({
  data,
  month,
  asOf,
  motionMode = 'system',
  onQuickAdd,
  onAccountQuickAdd,
  onTransactions,
  onPlanning,
  onReports,
}: DashboardProps) {
  const systemReduced = useReducedMotion();
  const reduce = Boolean(systemReduced) || motionMode === 'reduced';
  const [balancesVisible, setBalancesVisible] = useState(true);
  const flow = selectMonthlyFlow(data, month);
  const previousMonth = shiftMonth(month, -1);
  const previousFlow = selectMonthlyFlow(data, previousMonth);
  const balances = selectAccountBalances(data, asOf);
  const previousBalances = selectAccountBalances(data, previousMonthEnd(month));
  const accounts = allAccounts(data).filter((account) => account.kind !== 'credit');
  const primary = PRIMARY_ACCOUNTS.map((id) => accounts.find((account) => account.id === id)).filter(Boolean) as typeof accounts;
  const remaining = accounts.filter((account) => !PRIMARY_ACCOUNTS.includes(account.id));
  const categories = selectCategoryTotals(data, month).slice(0, 6);
  const frequent = selectFrequentDescriptions(data, 'expense', 5);
  const rows = useMemo(() => buildMonthRows(data, month), [data, month]);
  const daily = useMemo(() => buildDailyFlow(data, month), [data, month]);
  const cumulative = useMemo(() => { let income = 0; let expense = 0; return daily.map((row) => ({ ...row, income: (income += row.income), expense: (expense += row.expense) })); }, [daily]);
  const scheduled = pendingScheduled(data)
    .filter((item) => item.dueDate >= `${month}-01`)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const recurring = effectiveRecurringItems(data)
    .filter((item) => item.active && item.day)
    .slice(0, Math.max(0, 3 - scheduled.length));
  const net = flow.income - flow.expense;
  const previousNet = previousFlow.income - previousFlow.expense;
  const saveRate = flow.income > 0 ? net / flow.income : 0;
  const savingsTarget = data.state.settings.savingsTargetRate ?? 0.2;
  const expenseChange = percentChange(flow.expense, previousFlow.expense);
  const incomeChange = percentChange(flow.income, previousFlow.income);
  const netChange = percentChange(net, previousNet);
  const elapsedDays = asOf.startsWith(`${month}-`) ? Math.max(1, Number(asOf.slice(-2))) : Number(monthRange(month).end.slice(-2));
  const averageExpense = flow.expense / elapsedDays;
  const startBalances = selectAccountBalances(data, previousMonthEnd(month));
  const startTotal = accounts.reduce((sum, account) => sum + (startBalances[account.id] ?? 0), 0);
  const endTotal = accounts.reduce((sum, account) => sum + (balances[account.id] ?? 0), 0);
  const topCategory = categories[0];
  const topCategoryShare = flow.expense > 0 && topCategory ? topCategory.value / flow.expense : 0;

  return (
    <div className="page-stack dashboard-target">
      <section className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">ΕΠΙΣΚΟΠΗΣΗ</span>
          <h1>Οι λογαριασμοί μου</h1>
          <p>Πλήρης εικόνα των οικονομικών σας. Τα πιο σημαντικά στοιχεία με μια ματιά.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="secondary privacy-toggle"
            aria-pressed={balancesVisible}
            onClick={() => setBalancesVisible((value) => !value)}
          >
            {balancesVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            {balancesVisible ? 'Απόκρυψη ποσών' : 'Εμφάνιση ποσών'}
          </button>
        </div>
      </section>

      <section className="dashboard-primary-grid" aria-label="Κύριοι λογαριασμοί" data-dashboard-section="primary-accounts">
        {primary.map((account) => {
          const current = balances[account.id] ?? 0;
          const previous = previousBalances[account.id] ?? 0;
          const change = percentChange(current, previous);
          const series = buildBalanceSeries(data, account.id, month, asOf);
          const tone = toneForAccount(account.kind);
          return (
            <article className={`dashboard-account-card dashboard-account-${tone}`} key={account.id} data-account-id={account.id}>
              <div className="dashboard-account-head">
                <BankBrandMark id={account.id} name={accountDisplayName(data, account.id)} />
                <div className="dashboard-account-name">
                  <b>{accountDisplayName(data, account.id)}</b>
                  <AccountIban accountId={account.id} masked/>
                </div>
                {account.kind === 'savings' ? (
                  <span className="dashboard-goal-pill">
                    <Target size={13} /> Στόχος {Math.round(savingsTarget * 100)}%
                  </span>
                ) : null}
              </div>
              <div className="dashboard-account-body">
                <div className="dashboard-account-balance">
                  <AnimatedAmount value={current} hidden={!balancesVisible} className={current < 0 ? 'negative' : ''} />
                  <span className={change !== null && change < 0 ? 'dashboard-trend down' : 'dashboard-trend up'}>
                    {change !== null && change < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                    {trendCopy(change)}
                  </span>
                </div>
                <div className="dashboard-account-spark" aria-hidden="true">
                  <ResponsiveContainer width="100%" height={62}>
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id={`account-fill-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="currentColor"
                        strokeWidth={2}
                        fill={`url(#account-fill-${account.id})`}
                        isAnimationActive={!reduce}
                        animationDuration={reduce ? 0 : 450}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="dashboard-account-actions">
                <button
                  type="button"
                  data-account-quick-entry={account.id}
                  aria-label={`Νέα κίνηση για ${accountDisplayName(data, account.id)}`}
                  onClick={() => onAccountQuickAdd(account.id, account.kind)}
                >
                  <ArrowRight size={15} /> Κίνηση
                </button>
                <button type="button" onClick={onTransactions}>
                  <List size={15} /> Συναλλαγές
                </button>
                <button type="button" aria-label={`Περισσότερα για ${accountDisplayName(data, account.id)}`} onClick={onTransactions}>
                  <MoreHorizontal size={17} />
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {remaining.length ? (
        <section className="dashboard-other-accounts" data-dashboard-section="other-balances" aria-label="Λοιποί λογαριασμοί">
          <h2>Λοιποί λογαριασμοί</h2>
          <div className="dashboard-other-grid">
            {remaining.slice(0, 4).map((account) => (
              <article key={account.id}>
                <BankBrandMark id={account.id} name={accountDisplayName(data, account.id)} />
                <div>
                  <b>{accountDisplayName(data, account.id)}</b>
                  <AnimatedAmount value={balances[account.id] ?? 0} hidden={!balancesVisible} className={(balances[account.id] ?? 0) < 0 ? 'negative' : ''} />
                </div>
                <button type="button" onClick={onTransactions}>Συναλλαγές</button>
              </article>
            ))}
            {remaining.length > 4 ? (
              <button type="button" className="dashboard-more-accounts" onClick={onTransactions}>
                + {remaining.length - 4} ακόμα
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      {!remaining.length ? (
        <section className="dashboard-other-accounts dashboard-other-empty-section" data-dashboard-section="other-balances" aria-label="Λοιποί λογαριασμοί">
          <h2>Λοιποί λογαριασμοί</h2>
          <div className="dashboard-other-empty">Δεν υπάρχουν άλλοι λογαριασμοί για την τρέχουσα προβολή.</div>
        </section>
      ) : null}

      <section className="dashboard-middle-grid" data-dashboard-section="pending">
        <article className="dashboard-panel dashboard-transactions-panel">
          <header>
            <h2>Κινήσεις μήνα</h2>
            <button type="button" onClick={onTransactions}>Προβολή όλων</button>
          </header>
          {rows.length ? (
            <div className="dashboard-transaction-table">
              <div className="dashboard-table-head" aria-hidden="true">
                <span>Συναλλαγή</span><span>Κατηγορία</span><span>Ημερομηνία</span><span>Ποσό</span>
              </div>
              {rows.slice(0, 5).map((row) => (
                <button type="button" className="dashboard-transaction-row" key={row.id} onClick={onTransactions}>
                  <span className="dashboard-transaction-name"><MonthListIcon row={row} /><b>{row.note}</b></span>
                  <span>{row.category}</span>
                  <time dateTime={row.date}>{shortDate(row.date)}</time>
                  <strong className={row.amount < 0 ? 'negative' : row.amount > 0 ? 'positive' : ''}>
                    {row.amount === 0 ? '—' : money.format(row.amount)}
                  </strong>
                </button>
              ))}
            </div>
          ) : <div className="dashboard-empty">Δεν υπάρχουν κινήσεις για την επιλεγμένη περίοδο.</div>}
          <button type="button" className="dashboard-panel-footer" onClick={onTransactions}>
            Προβολή όλων των κινήσεων <ArrowRight size={14} />
          </button>
        </article>

        <article className="dashboard-panel dashboard-upcoming-panel">
          <header>
            <h2>Επερχόμενες πληρωμές</h2>
            <button type="button" onClick={onPlanning}>Προβολή όλων</button>
          </header>
          <div className="dashboard-upcoming-groups">
            {scheduled.length ? (
              <section>
                <h3 aria-label="Προγραμματισμένα one-off">Προγραμματισμένα</h3>
                {scheduled.map((item) => (
                  <button type="button" key={item.id} className="dashboard-upcoming-row" onClick={onPlanning}>
                    <span className="dashboard-list-icon"><CalendarDays size={16} /></span>
                    <span><b>{item.note}</b><small>{item.category || eventLabel(item.kind)}</small></span>
                    <time dateTime={item.dueDate}>{shortDate(item.dueDate)}</time>
                    <strong className={item.kind === 'income' ? 'positive' : 'negative'}>
                      {money.format(item.kind === 'income' ? item.amount : -item.amount)}
                    </strong>
                  </button>
                ))}
              </section>
            ) : null}
            {recurring.length ? (
              <section>
                <h3>Πάγια</h3>
                {recurring.map((item) => {
                  const day = Math.min(Number(item.day || 1), Number(monthRange(month).end.slice(-2)));
                  const dueDate = `${month}-${String(day).padStart(2, '0')}`;
                  return (
                    <button type="button" key={item.id} className="dashboard-upcoming-row" onClick={onPlanning}>
                      <span className="dashboard-list-icon"><Repeat2 size={16} /></span>
                      <span><b>{item.name}</b><small>{item.category}</small></span>
                      <time dateTime={dueDate}>{shortDate(dueDate)}</time>
                      <strong className="negative">{money.format(-item.amount)}</strong>
                    </button>
                  );
                })}
              </section>
            ) : null}
            {!scheduled.length && !recurring.length ? <div className="dashboard-empty">Δεν υπάρχουν επερχόμενες πληρωμές.</div> : null}
          </div>
        </article>

        <article className="dashboard-panel dashboard-summary-panel">
          <header>
            <h2>Σύνοψη οικονομικών</h2>
            <span>{monthRange(month).start.split('-').reverse().join('/')} – {monthRange(month).end.split('-').reverse().join('/')}</span>
          </header>
          <div className="dashboard-summary-row positive">
            <div><span>Έσοδα</span><b>{money.format(flow.income)}</b><small><ArrowUpRight size={13} /> {trendCopy(incomeChange)}</small></div>
            <div className="dashboard-summary-spark" aria-hidden="true">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={cumulative}><Line type="monotone" dataKey="income" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={!reduce} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="dashboard-summary-row negative">
            <div><span>Έξοδα</span><b>{money.format(-flow.expense)}</b><small><ArrowDownRight size={13} /> {trendCopy(expenseChange)}</small></div>
            <div className="dashboard-summary-spark" aria-hidden="true">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={cumulative}><Line type="monotone" dataKey="expense" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={!reduce} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={net < 0 ? 'dashboard-net-row negative' : 'dashboard-net-row positive'}>
            <div>
              <span>Καθαρή αποταμίευση</span>
              <b>{money.format(net)}</b>
              <small>{trendCopy(netChange)}</small>
            </div>
            <div className="dashboard-save-ring" style={{ '--saving-rate': `${Math.max(0, Math.min(100, saveRate * 100)) * 3.6}deg` } as CSSProperties}>
              <span>{Math.round(saveRate * 100)}%</span>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-analytics-grid">
        <article className="dashboard-panel dashboard-flow-panel">
          <header>
            <div>
              <h2>Έσοδα &amp; Έξοδα</h2>
              <span className="dashboard-chart-legend"><i className="income" /> Έσοδα <i className="expense" /> Έξοδα</span>
            </div>
          </header>
          {daily.some((row) => row.income || row.expense) ? (
            <>
              <div className="dashboard-bar-chart" aria-hidden="true">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={daily} barGap={1}>
                    <CartesianGrid stroke="#dfe8f3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#71819a' }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 9, fill: '#71819a' }} axisLine={false} tickLine={false} width={42} />
                    <Tooltip formatter={(value) => money.format(Number(value))} />
                    <Bar dataKey="income" fill="#35c47a" radius={[2, 2, 0, 0]} isAnimationActive={!reduce} />
                    <Bar dataKey="expense" fill="#ff5f68" radius={[2, 2, 0, 0]} isAnimationActive={!reduce} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-alt">
                <summary>Ημερήσια ποσά σε κείμενο</summary>
                <ul className="chart-alt-list">
                  {daily.filter((row) => row.income || row.expense).map((row) => (
                    <li key={row.day}><span>Ημέρα {row.day}</span><b>Έσοδα {money.format(row.income)} · Έξοδα {money.format(row.expense)}</b></li>
                  ))}
                </ul>
              </details>
            </>
          ) : <div className="dashboard-empty">Δεν υπάρχουν δεδομένα ροής για την περίοδο.</div>}
        </article>

        <article className="dashboard-panel dashboard-category-panel">
          <header>
            <h2>Κατηγορίες εξόδων</h2>
          </header>
          {categories.length ? (
            <div className="dashboard-category-layout">
              <div className="dashboard-donut-wrap" aria-hidden="true">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius={50} outerRadius={73} paddingAngle={1.5} isAnimationActive={!reduce}>
                      {categories.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => money.format(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div><b>{compactMoney.format(flow.expense)}</b><span>Σύνολο εξόδων</span></div>
              </div>
              <div className="dashboard-category-table">
                <div className="dashboard-category-head"><span>Κατηγορία</span><span>Ποσό</span><span>%</span></div>
                {categories.map((category, index) => (
                  <div key={category.name}>
                    <span><i style={{ background: chartColors[index % chartColors.length] }} />{category.name}</span>
                    <b>{money.format(category.value)}</b>
                    <strong>{flow.expense > 0 ? Math.round((category.value / flow.expense) * 100) : 0}%</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="dashboard-empty">Δεν υπάρχουν έξοδα για την επιλεγμένη περίοδο.</div>}
          <button type="button" className="dashboard-panel-footer" onClick={onReports}>
            Προβολή αναλυτικής αναφοράς <ArrowRight size={14} />
          </button>
        </article>
      </section>

      <section className="dashboard-mobile-shortcuts dashboard-panel" data-dashboard-section="quick-entry">
        <header><div><h2>Συχνές κινήσεις</h2><small>Συντομεύσεις με προ-συμπληρωμένα στοιχεία</small></div></header>
        <div className="frequent-grid">
          {frequent.map((f) => (
            <button
              type="button"
              key={f.label}
              data-prefilled-quick-entry={f.label}
              onClick={() => onQuickAdd({ note: f.label, amount: f.lastAmount, category: f.category, accountId: f.accountId })}
            >
              <span className="frequent-icon"><FinanceIcon kind="expense" note={f.label} category={f.category} size={15} /></span>
              <b>{f.label}</b><span>{f.count} φορές</span><strong>{money.format(f.lastAmount)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-kpi-grid" data-dashboard-section="rest">
        <article>
          <span className="dashboard-kpi-icon blue"><TrendingDown size={18} /></span>
          <div><small>Μέση ημερήσια δαπάνη</small><b>{money.format(averageExpense)}</b><span className={expenseChange !== null && expenseChange > 0 ? 'negative' : 'positive'}>{trendCopy(expenseChange)}</span></div>
        </article>
        <article>
          <span className="dashboard-kpi-icon green"><WalletCards size={18} /></span>
          <div><small>Μεγαλύτερη κατηγορία</small><b>{topCategory?.name ?? '—'}</b><span>{topCategory ? `${money.format(topCategory.value)} (${Math.round(topCategoryShare * 100)}%)` : 'Χωρίς έξοδα'}</span></div>
        </article>
        <article>
          <span className="dashboard-kpi-icon blue"><PiggyBank size={18} /></span>
          <div><small>Ποσοστό αποταμίευσης</small><b>{Math.round(saveRate * 100)}%</b><span>Στόχος {Math.round(savingsTarget * 100)}%</span></div>
        </article>
        <article>
          <span className="dashboard-kpi-icon blue"><Repeat2 size={18} /></span>
          <div><small>Συναλλαγές</small><b>{rows.length}</b><span>{rows.length ? 'στην επιλεγμένη περίοδο' : 'χωρίς κινήσεις'}</span></div>
        </article>
        <article>
          <span className="dashboard-kpi-icon violet"><ArrowUpRight size={18} /></span>
          <div><small>Υπόλοιπο στην αρχή</small><b><AnimatedAmount value={startTotal} hidden={!balancesVisible} /></b><span>{previousMonthEnd(month).split('-').reverse().join('/')}</span></div>
        </article>
        <article>
          <span className="dashboard-kpi-icon green"><ArrowRight size={18} /></span>
          <div><small>Υπόλοιπο στο τέλος</small><b><AnimatedAmount value={endTotal} hidden={!balancesVisible} /></b><span>έως {asOf.split('-').reverse().join('/')}</span></div>
        </article>
      </section>
    </div>
  );
}
