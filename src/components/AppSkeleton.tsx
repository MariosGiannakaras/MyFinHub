function DashboardSkeletonContent(){
  return <>
    <div className="skeleton heading"/>
    <div className="skeleton-account-grid" data-skeleton-section="primary-accounts">
      <div className="skeleton account primary-account"/><div className="skeleton account primary-account"/><div className="skeleton account primary-account"/>
    </div>
    <div className="skeleton panel" data-skeleton-section="other-balances"/>
    <div className="skeleton-panel-grid" data-skeleton-section="pending"><div className="skeleton panel"/><div className="skeleton panel"/><div className="skeleton panel"/></div>
    <div className="skeleton panel" data-skeleton-section="quick-entry"/>
    <div className="skeleton-panel-grid" data-skeleton-section="rest"><div className="skeleton panel"/><div className="skeleton panel"/><div className="skeleton panel"/></div>
  </>;
}

function RouteSkeletonContent({page}:{page:string}){
  if(page==='dashboard')return <DashboardSkeletonContent/>;
  if(page==='reports')return <><div className="skeleton heading"/><div className="skeleton-account-grid" data-skeleton-section="report-kpis"><div className="skeleton account"/><div className="skeleton account"/><div className="skeleton account"/></div><div className="skeleton-panel-grid" data-skeleton-section="report-charts"><div className="skeleton panel"/><div className="skeleton panel"/></div></>;
  if(page==='transactions'||page==='review')return <><div className="skeleton heading"/><div className="skeleton panel" data-skeleton-section="ledger-list"/><div className="skeleton panel" data-skeleton-section="ledger-detail"/></>;
  if(page==='planning'||page==='attention')return <><div className="skeleton heading"/><div className="skeleton-panel-grid" data-skeleton-section="action-panels"><div className="skeleton panel"/><div className="skeleton panel"/><div className="skeleton panel"/></div></>;
  if(page==='settings')return <><div className="skeleton heading"/><div className="skeleton-panel-grid" data-skeleton-section="settings-panels"><div className="skeleton panel"/><div className="skeleton panel"/></div></>;
  return <><div className="skeleton heading"/><div className="skeleton-account-grid"><div className="skeleton account"/><div className="skeleton account"/></div><div className="skeleton-panel-grid"><div className="skeleton panel"/><div className="skeleton panel"/></div></>;
}

export function AppSkeleton(){
  return <div className="skeleton-shell" aria-label="Φόρτωση οικονομικών δεδομένων" role="status">
    <aside className="skeleton-sidebar neo-raised">
      <div className="skeleton brand"/><div className="skeleton primary"/>
      {Array.from({length:12},(_,i)=><div className="skeleton nav" key={i}/>) }
    </aside>
    <main className="skeleton-main">
      <div className="skeleton topbar"/>
      <div className="skeleton-workspace" data-skeleton-page="dashboard"><DashboardSkeletonContent/></div>
    </main>
  </div>;
}

export function PageSkeleton({page='dashboard'}:{page?:string}){
  return <div className="page-skeleton" role="status" aria-label="Ανανέωση δεδομένων" data-skeleton-page={page}>
    <RouteSkeletonContent page={page}/>
  </div>;
}
