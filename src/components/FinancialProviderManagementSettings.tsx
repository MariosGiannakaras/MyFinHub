import { ImagePlus, Landmark, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFinancialProviders } from '../hooks/useFinancialProviders';
import {
  saveFinancialProvider,
  uploadFinancialProviderAsset,
  type FinancialProviderWriteInput,
} from '../lib/financialProviderClient';
import type { FinancialProvider, FinancialProviderAssetRole, FinancialProviderKind } from '../lib/financialProviders';
import { Button } from './Button';
import { BankBrandMark } from './BankBrandMark';
import './FinancialProviderManagementSettings.css';

type AssetSlot={
  id:'logo'|'wordmark-light'|'wordmark-dark'|'card-light'|'card-dark';
  label:string;
  role:FinancialProviderAssetRole;
  variant:string;
  makePrimary:boolean;
  tone:'light'|'dark';
};
const ASSET_SLOTS:AssetSlot[]=[
  {id:'logo',label:'Logo',role:'logo',variant:'universal',makePrimary:true,tone:'light'},
  {id:'wordmark-light',label:'Wordmark · Light',role:'wordmark',variant:'light',makePrimary:true,tone:'light'},
  {id:'wordmark-dark',label:'Wordmark · Dark',role:'wordmark',variant:'dark',makePrimary:false,tone:'dark'},
  {id:'card-light',label:'Card mark · Light',role:'card-mark',variant:'light',makePrimary:false,tone:'light'},
  {id:'card-dark',label:'Card mark · Dark',role:'card-mark',variant:'dark',makePrimary:false,tone:'dark'},
];
const ACCEPT='image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';
const MAX_BYTES=2*1024*1024;

function providerSlug(value:string){
  const greek:Record<string,string>={
    α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o',
  };
  return value.toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').split('').map(char=>greek[char]??char).join('')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);
}
function assetForSlot(provider:FinancialProvider,slot:AssetSlot){
  const exact=(provider.assets??[]).find(asset=>asset.role===slot.role&&asset.variant===slot.variant);
  if(exact)return exact;
  if(slot.role==='wordmark')return (provider.assets??[]).find(asset=>asset.role==='wordmark'&&asset.variant.startsWith(slot.variant+'-'));
  if(slot.id==='logo')return (provider.assets??[]).find(asset=>asset.role==='logo'&&asset.variant==='universal')
    ??(provider.assets??[]).find(asset=>asset.assetKey===provider.logoAssetKey);
  return undefined;
}
function kindLabel(kind:FinancialProviderKind){
  return kind==='bank'?'Τράπεζα':kind==='fintech'?'Ψηφιακός πάροχος':kind==='wallet'?'Ψηφιακό πορτοφόλι':'Πάροχος πληρωμών';
}
function validateFile(file:File){
  if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type))return 'Υποστηρίζονται PNG, JPG, WebP και SVG.';
  if(!file.size||file.size>MAX_BYTES)return 'Κάθε εικόνα πρέπει να είναι έως 2 MB.';
  return '';
}

export function FinancialProviderManagementSettings(){
  const catalog=useFinancialProviders();
  const providers=catalog.providers;
  const replaceInput=useRef<HTMLInputElement|null>(null);
  const [replaceTarget,setReplaceTarget]=useState<{provider:FinancialProvider;slot:AssetSlot}|null>(null);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [createOpen,setCreateOpen]=useState(false);
  const [draft,setDraft]=useState<FinancialProviderWriteInput>({id:'',displayName:'',shortName:'',providerKind:'bank',countryCode:'GR',sortOrder:1000});
  const [newFiles,setNewFiles]=useState<Partial<Record<AssetSlot['id'],File>>>({});

  const chooseReplace=(provider:FinancialProvider,slot:AssetSlot)=>{
    if(busy)return;
    setMessage('');
    setReplaceTarget({provider,slot});
    replaceInput.current?.click();
  };
  const replace=async(file?:File)=>{
    const target=replaceTarget;
    if(!file||!target)return;
    const error=validateFile(file);
    if(error){setMessage(error);return}
    const key=`${target.provider.id}:${target.slot.id}`;
    setBusy(key);setMessage('');
    try{
      await uploadFinancialProviderAsset({
        providerId:target.provider.id,
        role:target.slot.role,
        variant:target.slot.variant,
        file,
        makePrimary:target.slot.makePrimary,
      });
      setMessage(`Η εικόνα «${target.slot.label}» του ${target.provider.displayName} ενημερώθηκε.`);
    }catch(error){
      setMessage(error instanceof Error?error.message:'Δεν ήταν δυνατή η ενημέρωση της εικόνας.');
    }finally{
      setBusy('');setReplaceTarget(null);
      if(replaceInput.current)replaceInput.current.value='';
    }
  };

  const updateName=(displayName:string)=>{
    const previousAuto=providerSlug(draft.displayName);
    const id=!draft.id||draft.id===previousAuto?providerSlug(displayName):draft.id;
    setDraft({...draft,displayName,id,shortName:draft.shortName||displayName});
  };
  const create=async()=>{
    if(busy)return;
    if(!draft.displayName.trim()||!draft.shortName.trim()||!/^[a-z][a-z0-9-]{0,63}$/.test(draft.id)){
      setMessage('Συμπλήρωσε όνομα, σύντομο όνομα και έγκυρο provider ID.');
      return;
    }
    if(providers.some(provider=>provider.id===draft.id)){
      setMessage('Υπάρχει ήδη πάροχος με αυτό το provider ID.');
      return;
    }
    for(const file of Object.values(newFiles)){
      if(!file)continue;
      const error=validateFile(file);
      if(error){setMessage(error);return}
    }
    setBusy('create');setMessage('');
    try{
      await saveFinancialProvider({...draft,countryCode:draft.countryCode?.trim().toUpperCase()||null});
      for(const slot of ASSET_SLOTS){
        const file=newFiles[slot.id];
        if(!file)continue;
        await uploadFinancialProviderAsset({providerId:draft.id,role:slot.role,variant:slot.variant,file,makePrimary:slot.makePrimary});
      }
      setMessage(`Ο πάροχος «${draft.displayName}» δημιουργήθηκε${Object.keys(newFiles).length?' μαζί με τις επιλεγμένες εικόνες.':'.'}`);
      setDraft({id:'',displayName:'',shortName:'',providerKind:'bank',countryCode:'GR',sortOrder:Math.max(1000,...providers.map(provider=>provider.sortOrder+10))});
      setNewFiles({});setCreateOpen(false);
    }catch(error){
      setMessage(error instanceof Error?error.message:'Δεν ήταν δυνατή η δημιουργία του παρόχου.');
    }finally{setBusy('')}
  };

  return <section className="provider-management panel neo-raised" aria-labelledby="provider-management-title">
    <input ref={replaceInput} type="file" accept={ACCEPT} hidden onChange={event=>void replace(event.target.files?.[0])}/>
    <header className="provider-management-head">
      <div><span className="provider-management-kicker">ΤΡΑΠΕΖΕΣ & ΠΑΡΟΧΟΙ</span><h2 id="provider-management-title">Εικόνες παρόχων</h2><p>Τα logos χρησιμοποιούνται κοινά σε λογαριασμούς και κάρτες. Μπορείς να τα αντικαταστήσεις χωρίς αλλαγή κώδικα ή νέο build.</p></div>
      <Button type="button" variant="secondary" onClick={()=>{setMessage('');setCreateOpen(value=>!value)}}><Plus/> Νέος πάροχος</Button>
    </header>

    {message?<div className="provider-management-message" role="status" aria-live="polite">{message}</div>:null}

    {createOpen?<div className="provider-create">
      <div className="provider-create-grid">
        <label><span>Όνομα</span><input value={draft.displayName} onChange={event=>updateName(event.target.value)} placeholder="π.χ. Νέα Τράπεζα"/></label>
        <label><span>Σύντομο όνομα</span><input value={draft.shortName} onChange={event=>setDraft({...draft,shortName:event.target.value})} placeholder="π.χ. Νέα"/></label>
        <label><span>Provider ID</span><input value={draft.id} onChange={event=>setDraft({...draft,id:providerSlug(event.target.value)})} placeholder="nea-trapeza"/></label>
        <label><span>Τύπος</span><select value={draft.providerKind} onChange={event=>setDraft({...draft,providerKind:event.target.value as FinancialProviderKind})}><option value="bank">Τράπεζα</option><option value="fintech">Ψηφιακός πάροχος</option><option value="wallet">Ψηφιακό πορτοφόλι</option><option value="payment">Πάροχος πληρωμών</option></select></label>
        <label><span>Χώρα (ISO)</span><input maxLength={2} value={draft.countryCode??''} onChange={event=>setDraft({...draft,countryCode:event.target.value.toUpperCase()})} placeholder="GR"/></label>
      </div>
      <div className="provider-create-assets">
        <b><ImagePlus size={17}/> Εικόνες κατά τη δημιουργία</b>
        <p>Διάλεξε όσες έχεις τώρα. Μπορείς να προσθέσεις ή να αλλάξεις τις υπόλοιπες αργότερα.</p>
        <div className="provider-create-assets-grid">{ASSET_SLOTS.map(slot=><label key={slot.id} className="provider-file-choice"><span>{slot.label}</span><input type="file" accept={ACCEPT} onChange={event=>{const file=event.target.files?.[0];setNewFiles(current=>({...current,[slot.id]:file}))}}/><small>{newFiles[slot.id]?.name??'Δεν επιλέχθηκε αρχείο'}</small></label>)}</div>
      </div>
      <div className="provider-create-actions"><Button type="button" variant="secondary" disabled={busy==='create'} onClick={()=>{setCreateOpen(false);setNewFiles({})}}>Ακύρωση</Button><Button type="button" variant="primary" disabled={busy==='create'} onClick={()=>void create()}>{busy==='create'?'Δημιουργία…':'Δημιουργία παρόχου'}</Button></div>
    </div>:null}

    <div className="provider-management-list">{providers.map(provider=><article className="provider-management-card" key={provider.id}>
      <div className="provider-management-identity"><BankBrandMark id={provider.id} name={provider.displayName}/><div><b>{provider.displayName}</b><span>{kindLabel(provider.kind)} · {provider.id}</span></div></div>
      <div className="provider-asset-grid">{ASSET_SLOTS.map(slot=>{const asset=assetForSlot(provider,slot);const key=`${provider.id}:${slot.id}`;return <div className={`provider-asset-slot ${slot.tone}`} key={slot.id}>
        <div className="provider-asset-preview">{asset?<img src={asset.url} alt="" draggable={false}/>:slot.id==='logo'?<BankBrandMark id={provider.id} name={provider.displayName}/>:<Landmark aria-hidden="true"/>}</div>
        <div className="provider-asset-copy"><b>{slot.label}</b><small>{asset?.variant??'Δεν έχει οριστεί'}</small></div>
        <button type="button" disabled={Boolean(busy)} onClick={()=>chooseReplace(provider,slot)}>{busy===key?'Ανέβασμα…':asset?'Αλλαγή':'Προσθήκη'}</button>
      </div>})}</div>
    </article>)}</div>
  </section>;
}
