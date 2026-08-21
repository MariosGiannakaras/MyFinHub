type LineProps={width?:string;size?:'eyebrow'|'title'|'text'|'amount'};
function Line({width='100%',size='text'}:LineProps){return <span className={`skeleton skeleton-line ${size}`} style={{width}}/>}
function Icon(){return <span className="skeleton skeleton-icon"/>}
function Button({wide=false}:{wide?:boolean}){return <span className={`skeleton skeleton-button${wide?' wide':''}`}/>}

function Heading({actions=1}:{actions?:number}){
  return <div className="skeleton-heading-shape"><div className="skeleton-heading-copy"><Line width="82px" size="eyebrow"/><Line width="min(360px,72%)" size="title"/><Line width="min(560px,92%)"/></div>{actions?<div className="skeleton-heading-actions">{Array.from({length:actions},(_,i)=><Button key={i}/>)}</div>:null}</div>;
}

function MetricCard({action=false}:{action?:boolean}){
  return <div className="skeleton-shape-card skeleton-metric-card"><div className="skeleton-card-head"><Line width="42%" size="eyebrow"/><Icon/></div><Line width="64%" size="amount"/><Line width="72%"/>{action?<Button/>:null}</div>;
}
function MetricGrid({count=3,className=''}:{count?:number;className?:string}){return <div className={`skeleton-metric-grid ${className}`}>{Array.from({length:count},(_,i)=><MetricCard key={i}/>)}</div>}

function Row({action=true,icon=true}:{action?:boolean;icon?:boolean}){
  return <div className="skeleton-list-row">{icon?<Icon/>:null}<div className="skeleton-row-copy"><Line width="72%"/><Line width="48%" size="eyebrow"/></div><Line width="74px" size="text"/>{action?<span className="skeleton skeleton-row-action"/>:null}</div>;
}
function Rows({count=4,action=true,icon=true}:{count?:number;action?:boolean;icon?:boolean}){return <div className="skeleton-row-list">{Array.from({length:count},(_,i)=><Row key={i} action={action} icon={icon}/>)}</div>}

function Panel({children,className='',button=false}:{children?:React.ReactNode;className?:string;button?:boolean}){
  return <div className={`skeleton-shape-panel ${className}`}><div className="skeleton-panel-title"><div><Line width="150px"/><Line width="220px" size="eyebrow"/></div><Icon/></div>{children}{button?<Button wide/>:null}</div>;
}
function Chart({height='260px'}:{height?:string}){return <div className="skeleton-chart" style={{minHeight:height}}><div className="skeleton-chart-grid"/><span className="skeleton-chart-line"/></div>}
function FormRows({count=4}:{count?:number}){return <div className="skeleton-form-grid">{Array.from({length:count},(_,i)=><label className="skeleton-form-field" key={i}><Line width={i%2?'42%':'58%'} size="eyebrow"/><span className="skeleton skeleton-input"/></label>)}</div>}

function DashboardSkeletonContent(){
  return <div className="skeleton-page-stack">
    <Heading actions={2}/>
    <div className="skeleton-primary-accounts" data-skeleton-section="primary-accounts">{Array.from({length:3},(_,i)=><div className="skeleton-shape-card skeleton-primary-account" key={i}><div className="skeleton-account-head"><Icon/><div><Line width="110px"/><Line width="72px" size="eyebrow"/></div></div><Line width="135px" size="amount"/><Button/></div>)}</div>
    <Panel className="skeleton-other-balances" data-skeleton-section="other-balances"><Rows count={3}/></Panel>
    <div className="skeleton-three-column" data-skeleton-section="pending">{Array.from({length:3},(_,i)=><Panel key={i} button><Rows count={3} action={false} icon={false}/></Panel>)}</div>
    <Panel className="skeleton-quick-entry" data-skeleton-section="quick-entry" button><div className="skeleton-frequent-grid">{Array.from({length:4},(_,i)=><div className="skeleton-frequent-item" key={i}><Icon/><Line width="68%"/><Line width="42%" size="eyebrow"/><Line width="64px"/></div>)}</div></Panel>
    <div className="skeleton-two-column"><Panel><div className="skeleton-chart-with-side"><Chart height="220px"/><Rows count={4} action={false} icon={false}/></div></Panel><Panel><Chart height="245px"/></Panel></div>
    <MetricGrid count={3} className="skeleton-dashboard-rest"/>
  </div>;
}

function TransactionsSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><div className="skeleton-toolbar"><span className="skeleton skeleton-control wide"/><span className="skeleton skeleton-control"/><span className="skeleton skeleton-control"/></div><Panel className="skeleton-ledger-panel"><div className="skeleton-table-head"><Line width="22%"/><Line width="18%"/><Line width="18%"/><Line width="14%"/></div><Rows count={7}/></Panel></div>}
function ReviewSkeleton(){return <div className="skeleton-page-stack"><Heading actions={0}/><MetricGrid count={3}/><Panel button><Rows count={5}/></Panel></div>}
function SavingsSkeleton(){return <div className="skeleton-page-stack"><Heading actions={2}/><MetricGrid count={3}/><div className="skeleton-two-column"><Panel button><Rows count={4}/></Panel><Panel><Chart height="220px"/></Panel></div><Panel><Rows count={4}/></Panel></div>}
function CardsSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><Panel><div className="skeleton-card-gallery">{Array.from({length:4},(_,i)=><div className="skeleton-payment-card" key={i}><div className="skeleton-card-head"><Icon/><Line width="72px"/></div><Line width="56%" size="amount"/><Line width="38%"/><div className="skeleton-inline-actions"><Button/><Button/></div></div>)}</div></Panel><Panel><Rows count={3}/></Panel></div>}
function CreditSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><MetricGrid count={4}/><div className="skeleton-two-column"><Panel button><div className="skeleton-credit-card"><Line width="42%"/><Line width="65%" size="amount"/><div className="skeleton-progress"/><Line width="54%"/></div></Panel><Panel><Rows count={5}/></Panel></div></div>}
function LoansSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><MetricGrid count={3}/><div className="skeleton-card-grid">{Array.from({length:3},(_,i)=><Panel key={i} button><Line width="58%" size="amount"/><div className="skeleton-progress"/><Rows count={2} action={false} icon={false}/></Panel>)}</div></div>}
function LendingSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><MetricGrid count={3}/><Panel><Rows count={6}/></Panel></div>}
function RecurringSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><MetricGrid count={3}/><Panel button><Rows count={6}/></Panel></div>}
function PlanningSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><MetricGrid count={4}/><Panel className="skeleton-forecast-panel"><div className="skeleton-forecast-layout"><Chart height="300px"/><div className="skeleton-forecast-facts">{Array.from({length:3},(_,i)=><div className="skeleton-fact" key={i}><Line width="62%" size="eyebrow"/><Line width="78%" size="amount"/><Line width="90%"/></div>)}</div></div><div className="skeleton-account-forecast-grid">{Array.from({length:3},(_,i)=><div className="skeleton-fact" key={i}><Line width="62%"/><Line width="48%" size="amount"/><Line width="80%" size="eyebrow"/></div>)}</div></Panel><Panel button><Rows count={5}/></Panel></div>}
function AttentionSkeleton(){return <div className="skeleton-page-stack"><Heading actions={0}/><MetricGrid count={3}/><Panel><Rows count={6}/></Panel></div>}
function ReportsSkeleton(){return <div className="skeleton-page-stack"><Heading actions={1}/><MetricGrid count={4}/><div className="skeleton-two-column"><Panel><Chart height="280px"/></Panel><Panel><Chart height="280px"/></Panel></div><div className="skeleton-two-column"><Panel><Rows count={5} action={false}/></Panel><Panel><Rows count={5} action={false}/></Panel></div><Panel><div className="skeleton-report-bars">{Array.from({length:5},(_,i)=><div key={i}><Line width={`${48+i*8}%`}/><div className="skeleton-progress"/></div>)}</div></Panel></div>}
function SettingsSkeleton(){return <div className="skeleton-page-stack"><Heading actions={0}/><Panel><div className="skeleton-setting-callout"><Icon/><div><Line width="190px"/><Line width="min(500px,90%)"/></div><Button/></div></Panel><Panel><div className="skeleton-segmented">{Array.from({length:3},(_,i)=><Button key={i}/>)}</div></Panel><div className="skeleton-two-column"><Panel><FormRows count={4}/><Button wide/></Panel><Panel><FormRows count={4}/><Button wide/></Panel></div><div className="skeleton-two-column"><Panel><FormRows count={5}/></Panel><Panel><FormRows count={5}/></Panel></div><Panel><FormRows count={3}/></Panel><Panel><Rows count={5} action={false} icon={false}/></Panel></div>}

function RouteSkeletonContent({page}:{page:string}){
  if(page==='dashboard')return <DashboardSkeletonContent/>;
  if(page==='transactions')return <TransactionsSkeleton/>;
  if(page==='review')return <ReviewSkeleton/>;
  if(page==='savings')return <SavingsSkeleton/>;
  if(page==='cards')return <CardsSkeleton/>;
  if(page==='credit')return <CreditSkeleton/>;
  if(page==='loans')return <LoansSkeleton/>;
  if(page==='lending')return <LendingSkeleton/>;
  if(page==='recurring')return <RecurringSkeleton/>;
  if(page==='planning')return <PlanningSkeleton/>;
  if(page==='attention')return <AttentionSkeleton/>;
  if(page==='reports')return <ReportsSkeleton/>;
  if(page==='settings')return <SettingsSkeleton/>;
  return <TransactionsSkeleton/>;
}

function activePage(){
  if(typeof location==='undefined')return 'dashboard';
  const hash=location.hash.replace(/^#\/?/,'').trim();
  if(hash)return hash;
  const query=new URLSearchParams(location.search).get('page');
  return query||'dashboard';
}

export function AppSkeleton(){
  const page=activePage();
  return <div className="skeleton-shell" aria-label="Φόρτωση οικονομικών δεδομένων" role="status">
    <aside className="skeleton-sidebar neo-raised"><div className="skeleton-shell-brand"><span className="skeleton skeleton-brand-icon"/><div><Line width="118px" size="title"/><Line width="92px" size="eyebrow"/></div></div><Button wide/><div className="skeleton-command-row"><Icon/><Line width="92px"/><span className="skeleton skeleton-key-hint"/></div><div className="skeleton-nav-list">{Array.from({length:12},(_,i)=><div className="skeleton-nav-row" key={i}><Icon/><Line width={`${52+(i%4)*9}%`}/></div>)}</div><div className="skeleton-file-card"><Line width="62%"/><Line width="82%" size="eyebrow"/></div></aside>
    <main className="skeleton-main"><div className="skeleton-topbar"><span className="skeleton skeleton-topbar-pill"/><div className="skeleton-topbar-actions">{Array.from({length:6},(_,i)=><span className="skeleton skeleton-topbar-action" key={i}/>)}</div></div><div className="skeleton-workspace" data-skeleton-page={page}><RouteSkeletonContent page={page}/></div></main>
  </div>;
}

export function PageSkeleton({page}:{page?:string}){
  const resolvedPage=page||activePage();
  return <div className="page-skeleton" role="status" aria-label="Ανανέωση δεδομένων" data-skeleton-page={resolvedPage}><RouteSkeletonContent page={resolvedPage}/></div>;
}
