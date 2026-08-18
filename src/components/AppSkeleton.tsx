export function AppSkeleton(){
  return <div className="skeleton-shell" aria-label="Φόρτωση οικονομικών δεδομένων" role="status">
    <aside className="skeleton-sidebar neo-raised">
      <div className="skeleton brand"/><div className="skeleton primary"/>
      {Array.from({length:8},(_,i)=><div className="skeleton nav" key={i}/>) }
    </aside>
    <main className="skeleton-main">
      <div className="skeleton topbar"/>
      <div className="skeleton-workspace">
        <div className="skeleton heading"/>
        <div className="skeleton-account-grid">
          <div className="skeleton account primary-account"/><div className="skeleton account primary-account"/>
          <div className="skeleton account"/><div className="skeleton account"/>
        </div>
        <div className="skeleton-panel-grid"><div className="skeleton panel"/><div className="skeleton panel"/></div>
      </div>
    </main>
  </div>;
}

export function PageSkeleton(){
  return <div className="page-skeleton" role="status" aria-label="Ανανέωση δεδομένων">
    <div className="skeleton heading"/>
    <div className="skeleton-account-grid"><div className="skeleton account primary-account"/><div className="skeleton account primary-account"/></div>
    <div className="skeleton-panel-grid"><div className="skeleton panel"/><div className="skeleton panel"/></div>
  </div>;
}
