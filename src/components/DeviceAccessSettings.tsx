import { Globe2, Monitor, RefreshCw, ShieldCheck, ShieldMinus, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, getConnectedDevices, revokeConnectedDevice, revokeOtherConnectedDevices, type ConnectedDevice } from '../lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import './DeviceAccessSettings.css';

type PendingAction={kind:'single';device:ConnectedDevice}|{kind:'others'}|null;

function deviceIcon(platform:ConnectedDevice['platform']){
  if(platform==='android')return <Smartphone size={18}/>;
  if(platform==='windows')return <Monitor size={18}/>;
  return <Globe2 size={18}/>;
}

function platformLabel(platform:ConnectedDevice['platform']){
  if(platform==='android')return 'Android';
  if(platform==='windows')return 'Windows';
  if(platform==='web')return 'Web';
  return 'Άγνωστη πλατφόρμα';
}

function activityLabel(value:string){
  const timestamp=Date.parse(value);
  if(!Number.isFinite(timestamp))return 'Πρόσφατα';
  const minutes=Math.max(0,Math.round((Date.now()-timestamp)/60_000));
  if(minutes<1)return 'Μόλις τώρα';
  if(minutes<60)return `Πριν από ${minutes} ${minutes===1?'λεπτό':'λεπτά'}`;
  const hours=Math.round(minutes/60);
  if(hours<24)return `Πριν από ${hours} ${hours===1?'ώρα':'ώρες'}`;
  return new Date(timestamp).toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function loadError(error:unknown){
  if(error instanceof ApiError&&error.code==='DEVICE_REGISTRY_NOT_MIGRATED')return 'Η υποδομή συσκευών θα ενεργοποιηθεί με την επόμενη ενημέρωση βάσης.';
  if(error instanceof ApiError&&(error.status===503||error.status===504))return 'Η λίστα συσκευών δεν είναι προσωρινά διαθέσιμη.';
  return 'Δεν ήταν δυνατή η φόρτωση των ενεργών συσκευών.';
}

export function DeviceAccessSettings(){
  const[devices,setDevices]=useState<ConnectedDevice[]>([]);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState('');
  const[pending,setPending]=useState<PendingAction>(null);

  const load=useCallback(async()=>{
    setLoading(true);setMessage('');
    try{const result=await getConnectedDevices();setDevices(result.devices)}
    catch(error){setDevices([]);setMessage(loadError(error))}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  const confirm=async()=>{
    if(!pending||busy)return;
    setBusy(true);setMessage('');
    try{
      const result=pending.kind==='others'
        ?await revokeOtherConnectedDevices()
        :await revokeConnectedDevice(pending.device.sessionId);
      setDevices(result.devices);
      setMessage(pending.kind==='others'?'Η πρόσβαση αφαιρέθηκε από όλες τις άλλες συσκευές.':'Η πρόσβαση της συσκευής αφαιρέθηκε.');
      setPending(null);
    }catch(error){setMessage(error instanceof ApiError&&error.code==='DEVICE_SESSION_NOT_FOUND'?'Η συσκευή δεν είναι πλέον ενεργή.':'Δεν ήταν δυνατή η αφαίρεση πρόσβασης. Δοκίμασε ξανά.')}
    finally{setBusy(false)}
  };

  const others=devices.filter(device=>!device.current);
  return <section className="panel neo-raised device-access-settings" aria-labelledby="device-access-title">
    <div className="panel-head">
      <div><span id="device-access-title">Συνδεδεμένες συσκευές</span><small>Δες πού είναι ενεργή η πρόσβαση στο MyFinHub και αφαίρεσέ την από συσκευή που δεν αναγνωρίζεις.</small></div>
      <div className="device-access-head-actions"><span className="device-access-count">{loading?'—':devices.length} ενεργές</span><button type="button" className="icon-button" aria-label="Ανανέωση συσκευών" title="Ανανέωση" disabled={loading||busy} onClick={()=>void load()}><RefreshCw size={16} className={loading?'is-spinning':''}/></button></div>
    </div>

    {loading?<div className="device-access-skeleton" aria-live="polite"><i/><i/></div>:devices.length?<div className="device-access-list" role="list">
      {devices.map(device=><div className="device-access-row" role="listitem" key={device.sessionId}>
        <div className={`device-access-icon platform-${device.platform}`}>{deviceIcon(device.platform)}</div>
        <div className="device-access-copy">
          <div className="device-access-name"><b>{device.label}</b>{device.current?<span className="device-access-current"><ShieldCheck size={12}/> Αυτή η συσκευή</span>:null}</div>
          <span>{platformLabel(device.platform)}{device.appVersion?` · MyFinHub ${device.appVersion}`:''}</span>
          <small>Τελευταία δραστηριότητα: {activityLabel(device.lastSeenAt)}</small>
        </div>
        {device.current?<span className="device-access-safe">Ενεργή</span>:<button type="button" className="secondary device-access-revoke" disabled={busy} onClick={()=>setPending({kind:'single',device})}><ShieldMinus size={15}/> Αφαίρεση</button>}
      </div>)}
    </div>:<div className="device-access-empty"><Monitor size={20}/><div><b>Δεν εμφανίζονται ενεργές συσκευές</b><span>{message||'Μόλις ολοκληρωθεί μια ασφαλής συνεδρία, η συσκευή θα εμφανιστεί εδώ.'}</span></div></div>}

    {devices.length&&message?<div className="device-access-message" role="status" aria-live="polite">{message}</div>:null}
    <div className="device-access-footer">
      <span>Windows, Android και web συνεδρίες χρησιμοποιούν την ίδια ασφαλή βάση πρόσβασης.</span>
      {others.length?<button type="button" className="secondary danger-text" disabled={busy} onClick={()=>setPending({kind:'others'})}>Αφαίρεση όλων των άλλων</button>:null}
    </div>

    <ConfirmDialog open={Boolean(pending)} title={pending?.kind==='others'?'Αφαίρεση πρόσβασης από όλες τις άλλες συσκευές;':`Αφαίρεση πρόσβασης από ${pending?.kind==='single'?pending.device.label:'τη συσκευή'};`} description="Η συγκεκριμένη πρόσβαση στο MyFinHub θα ανακληθεί. Η συσκευή θα χρειαστεί νέα πλήρη σύνδεση και επαλήθευση MFA για να ξαναμπεί." confirmLabel="Αφαίρεση πρόσβασης" tone="destructive" busy={busy} motionMode="full" onConfirm={()=>void confirm()} onCancel={()=>{if(!busy)setPending(null)}}/>
  </section>;
}
