import { CheckCircle2, Download, MonitorCog, RefreshCw, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

type UpdateStatus = 'idle'|'checking'|'up-to-date'|'available'|'downloading'|'ready'|'installing'|'error'|'unsupported';
type UpdateState = {supported:boolean;currentVersion:string;status:UpdateStatus;availableVersion:string|null;progress:number;message:string};
type DesktopInfo = {productName:string;version:string;packaged:boolean};
type DesktopBridge = {
  getInfo:()=>Promise<DesktopInfo>;
  getUpdateState:()=>Promise<UpdateState>;
  checkForUpdates:()=>Promise<UpdateState>;
  downloadUpdate:()=>Promise<UpdateState>;
  installUpdate:()=>Promise<UpdateState>;
  onUpdateState:(listener:(state:UpdateState)=>void)=>()=>void;
};

declare global { interface Window { myFinHubDesktop?:DesktopBridge } }

const idleState:UpdateState={supported:false,currentVersion:'',status:'idle',availableVersion:null,progress:0,message:''};
const busyStatuses=new Set<UpdateStatus>(['checking','downloading','installing']);

function statusLabel(state:UpdateState){
  if(state.status==='checking')return 'Έλεγχος ενημερώσεων';
  if(state.status==='available')return `Νέα έκδοση ${state.availableVersion??''}`.trim();
  if(state.status==='downloading')return `Λήψη ${state.progress}%`;
  if(state.status==='ready')return `Έτοιμη ${state.availableVersion??''}`.trim();
  if(state.status==='installing')return 'Εγκατάσταση & επανεκκίνηση';
  if(state.status==='up-to-date')return 'Ενημερωμένο';
  if(state.status==='error')return 'Χρειάζεται επανάληψη';
  return 'Ενημερώσεις Windows';
}

export function DesktopUpdatePanel(){
  const bridge=typeof window==='undefined'?undefined:window.myFinHubDesktop;
  const[info,setInfo]=useState<DesktopInfo|null>(null);
  const[state,setState]=useState<UpdateState>(idleState);
  const[localError,setLocalError]=useState('');

  useEffect(()=>{
    if(!bridge)return;
    let alive=true;
    const unsubscribe=bridge.onUpdateState(next=>{if(alive){setState(next);setLocalError('')}});
    void Promise.all([bridge.getInfo(),bridge.getUpdateState()]).then(([nextInfo,nextState])=>{if(!alive)return;setInfo(nextInfo);setState(nextState)}).catch(()=>{if(alive)setLocalError('Δεν ήταν δυνατή η ανάγνωση της κατάστασης ενημερώσεων.')});
    return()=>{alive=false;unsubscribe()};
  },[bridge]);

  if(!bridge)return null;
  const busy=busyStatuses.has(state.status);
  const run=async(action:()=>Promise<UpdateState>)=>{if(busy)return;setLocalError('');try{setState(await action())}catch{setLocalError('Η ενέργεια ενημέρωσης δεν ολοκληρώθηκε. Δεν άλλαξε η εγκατεστημένη έκδοση.')}};
  const action=state.status==='available'
    ?<button type="button" className="save-button" disabled={busy} onClick={()=>void run(bridge.downloadUpdate)}><Download size={16}/> Λήψη ενημέρωσης</button>
    :state.status==='ready'
      ?<button type="button" className="save-button" disabled={busy} onClick={()=>void run(bridge.installUpdate)}><RotateCcw size={16}/> Εγκατάσταση & επανεκκίνηση</button>
      :<button type="button" className="secondary" disabled={busy||state.status==='installing'} onClick={()=>void run(bridge.checkForUpdates)}><RefreshCw size={16} className={state.status==='checking'?'is-spinning':''}/> Έλεγχος τώρα</button>;

  return <article className="panel neo-raised desktop-update-panel" aria-labelledby="desktop-update-title">
    <div className="panel-head"><div><span id="desktop-update-title">MyFinHub για Windows</span><small>Η εφαρμογή ελέγχει αυτόματα το επίσημο GitHub Release channel. Η εγκατάσταση γίνεται μόνο όταν το επιλέξεις.</small></div><MonitorCog size={19}/></div>
    <div className="desktop-update-summary">
      <div><small>Τρέχουσα έκδοση</small><b>{info?.version||state.currentVersion||'—'}</b></div>
      <div><small>Κατάσταση</small><b>{statusLabel(state)}</b></div>
      {state.availableVersion?<div><small>Διαθέσιμη</small><b>{state.availableVersion}</b></div>:null}
    </div>
    {state.status==='downloading'||state.status==='ready'||state.status==='installing'?<div className="desktop-update-progress" role="progressbar" aria-label="Πρόοδος ενημέρωσης" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress}><i style={{width:`${Math.max(0,Math.min(100,state.progress))}%`}}/></div>:null}
    <div className={`desktop-update-message ${state.status==='error'||localError?'error':''}`} role="status" aria-live="polite">
      {state.status==='error'||localError?<TriangleAlert size={16}/>:state.status==='up-to-date'||state.status==='ready'?<CheckCircle2 size={16}/>:<ShieldCheck size={16}/>}<span>{localError||state.message||'Έτοιμο για ασφαλή έλεγχο ενημερώσεων.'}</span>
    </div>
    <div className="desktop-update-actions">{action}</div>
    <small className="desktop-update-note">Τα releases γίνονται δεκτά μόνο από το ελεγχόμενο MyFinHub channel και το installer επαληθεύεται με SHA-256 πριν γίνει διαθέσιμο για εγκατάσταση. Επειδή η προσωπική έκδοση μπορεί να είναι unsigned, τα Windows ενδέχεται να εμφανίσουν Unknown publisher / SmartScreen.</small>
  </article>;
}
