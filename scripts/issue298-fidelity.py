from pathlib import Path

p=Path('src/pages/DashboardPage.tsx')
s=p.read_text()
s=s.replace('  Cell,\n','').replace('  Pie,\n','').replace('  PieChart,\n','')
if 'function conicSegments' not in s:
    anchor="const chartColors = ['#39c77b', '#438ff1', '#ffb52e', '#a45de7', '#d95cc5', '#98a5b7'];\n"
    helper="""
function conicSegments(rows: { value: number }[], total: number) {
  if (!rows.length || total <= 0) return 'conic-gradient(#e6edf6 0 100%)';
  let cursor = 0;
  const parts = rows.map((row, index) => {
    const start = cursor;
    cursor = Math.min(100, cursor + (row.value / total) * 100);
    return `${chartColors[index % chartColors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  if (cursor < 100) parts.push(`#e6edf6 ${cursor.toFixed(2)}% 100%`);
  return `conic-gradient(${parts.join(', ')})`;
}
"""
    if anchor not in s: raise SystemExit('chart colors anchor missing')
    s=s.replace(anchor,anchor+helper,1)
anchor='  const topCategoryShare = flow.expense > 0 && topCategory ? topCategory.value / flow.expense : 0;\n'
if 'const flowVolume =' not in s:
    addition="  const flowVolume = flow.income + flow.expense;\n  const incomeShare = flowVolume > 0 ? flow.income / flowVolume : 0;\n  const categoryGradient = conicSegments(categories, flow.expense);\n"
    if anchor not in s: raise SystemExit('share anchor missing')
    s=s.replace(anchor,anchor+addition,1)
old='''              <ResponsiveContainer width="100%" height={60}>\n                <LineChart data={cumulative}><Line type="monotone" dataKey="income" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={!reduce} /></LineChart>\n              </ResponsiveContainer>'''
new='''              <ResponsiveContainer width="100%" height={60}>\n                <AreaChart data={cumulative}>\n                  <defs><linearGradient id="summary-income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>\n                  <YAxis hide domain={[0, (max: number) => Math.max(1, max * 1.08)]}/><Area type="monotone" dataKey="income" stroke="currentColor" strokeWidth={2} fill="url(#summary-income-fill)" dot={false} isAnimationActive={!reduce}/></AreaChart>\n              </ResponsiveContainer>'''
if old not in s: raise SystemExit('income summary chart anchor missing')
s=s.replace(old,new,1)
old='''              <ResponsiveContainer width="100%" height={60}>\n                <LineChart data={cumulative}><Line type="monotone" dataKey="expense" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={!reduce} /></LineChart>\n              </ResponsiveContainer>'''
new='''              <ResponsiveContainer width="100%" height={60}>\n                <AreaChart data={cumulative}>\n                  <defs><linearGradient id="summary-expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".2"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>\n                  <YAxis hide domain={[0, (max: number) => Math.max(1, max * 1.08)]}/><Area type="monotone" dataKey="expense" stroke="currentColor" strokeWidth={2} fill="url(#summary-expense-fill)" dot={false} isAnimationActive={!reduce}/></AreaChart>\n              </ResponsiveContainer>'''
if old not in s: raise SystemExit('expense summary chart anchor missing')
s=s.replace(old,new,1)
old='''            <div className="dashboard-save-ring" style={{ '--saving-rate': `${Math.max(0, Math.min(100, saveRate * 100)) * 3.6}deg` } as CSSProperties}>\n              <span>{Math.round(saveRate * 100)}%</span>\n            </div>'''
new='''            <div className="dashboard-summary-composition">\n              <div className="dashboard-summary-donut" style={{ '--income-share': `${Math.max(0, Math.min(1, incomeShare)) * 360}deg` } as CSSProperties}><span className="sr-only">Έσοδα {Math.round(incomeShare * 100)}%, έξοδα {Math.round((1 - incomeShare) * 100)}%</span></div>\n              <div className="dashboard-summary-legend"><span className="income">Έσοδα <b>{Math.round(incomeShare * 100)}%</b></span><span className="expense">Έξοδα <b>{Math.round((1 - incomeShare) * 100)}%</b></span></div>\n            </div>'''
if old not in s: raise SystemExit('summary donut anchor missing')
s=s.replace(old,new,1)
old='''                <ResponsiveContainer width="100%" height={160}>\n                  <PieChart>\n                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius={50} outerRadius={73} paddingAngle={1.5} isAnimationActive={!reduce}>\n                      {categories.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}\n                    </Pie>\n                    <Tooltip formatter={(value) => money.format(Number(value))} />\n                  </PieChart>\n                </ResponsiveContainer>'''
new='''                <div className="dashboard-category-donut" style={{ background: categoryGradient }} />'''
if old not in s: raise SystemExit('category donut anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

css=Path('src/styles/part48.css')
t=css.read_text()
if 'issue-298-reference-alignment-v4' not in t:
    t += '''\n\n/* issue-298-reference-alignment-v4 */\n@media(min-width:1180px){\n  .app-shell:has(.dashboard-target){--dashboard-sidebar:200px}\n  .app-shell:has(.dashboard-target) .top-actions{margin-right:238px}\n  .app-shell:has(.dashboard-target) .period-row{right:14px;width:220px}\n  .dashboard-account-balance .animated-amount{font-size:25px}\n  .dashboard-summary-row{grid-template-columns:minmax(110px,.78fr) 1.22fr}\n  .dashboard-summary-spark{height:52px}\n  .dashboard-net-row{grid-template-columns:minmax(120px,.8fr) 1.2fr}\n  .dashboard-summary-composition{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0}\n  .dashboard-summary-donut{--income-share:0deg;width:50px;height:50px;flex:0 0 50px;border-radius:50%;position:relative;background:conic-gradient(#39c77b 0 var(--income-share),#ff5f68 var(--income-share) 360deg)}\n  .dashboard-summary-donut::after{content:"";position:absolute;inset:10px;border-radius:50%;background:#fff}\n  .dashboard-summary-legend{display:grid;gap:6px;font-size:7.4px;color:#71819a;white-space:nowrap}\n  .dashboard-summary-legend span{display:flex;align-items:center;gap:5px;color:#71819a;font-weight:650}\n  .dashboard-summary-legend span::before{content:"";width:7px;height:7px;border-radius:50%;background:#39c77b}\n  .dashboard-summary-legend .expense::before{background:#ff5f68}\n  .dashboard-summary-legend b{color:#54647d;font-size:7.5px}\n  .dashboard-category-layout{grid-template-columns:210px minmax(0,1fr)}\n  .dashboard-donut-wrap{height:155px;display:grid;place-items:center}\n  .dashboard-category-donut{width:146px;height:146px;border-radius:50%;position:relative;box-shadow:inset 0 0 0 1px rgba(22,48,85,.03)}\n  .dashboard-category-donut::after{content:"";position:absolute;inset:31px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #edf2f7}\n  .dashboard-donut-wrap>div:last-child{z-index:2}\n  .dashboard-flow-panel{position:relative;min-height:190px}\n  .dashboard-flow-panel .chart-alt{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}\n  .dashboard-analytics-grid .dashboard-panel{min-height:190px}\n  .dashboard-kpi-grid article{min-height:60px}\n}\n'''
    css.write_text(t)
