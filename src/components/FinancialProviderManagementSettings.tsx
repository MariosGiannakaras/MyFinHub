import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ImagePlus, Images, Pencil, Plus, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFinancialProviders } from '../hooks/useFinancialProviders';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  refreshFinancialProviders,
  saveFinancialProvider,
  setFinancialProviderAssetBinding,
  updateFinancialProvider,
  uploadFinancialProviderAsset,
  type FinancialProviderWriteInput,
} from '../lib/financialProviderClient';
import type { FinancialProvider, FinancialProviderAssetRole, FinancialProviderKind } from '../lib/financialProviders';
import { AppSelectInput } from './AppSelectInput';
import { AppTextInput } from './AppTextInput';
import { BankBrandMark } from './BankBrandMark';
import { Button } from './Button';
import { IconButton } from './IconButton';
import './FinancialProviderManagementSettings.css';
import { userErrorMessage } from '../lib/userMessage';

type SlotVariant='universal'|'light'|'dark';
type SlotId=
  |'logo-default'|'logo-light'|'logo-dark'
  |'wordmark-default'|'wordmark-light'|'wordmark-dark'
  |'card-default'|'card-light'|'card-dark';
type SlotDefinition={
  id:SlotId;
  label:string;
  shortLabel:string;
  description:string;
  role:FinancialProviderAssetRole;
  variant:SlotVariant;
  required:boolean;
  preview:'neutral'|'light'|'dark';
};
type PendingAsset={
  ref:string;
  file:File;
  previewUrl:string;
  originSlot:SlotId;
  uploadedKey?:string;
};
type AssignmentMap=Record<SlotId,string|null>;
type ProviderEditor={
  source:'new'|'existing';
  tab:'details'|'branding';
  id:string;
  displayName:string;
  shortName:string;
  providerKind:FinancialProviderKind;
  countryCode:string;
  sortOrder:number;
  assignments:AssignmentMap;
  originalAssignments:AssignmentMap;
  pendingAssets:PendingAsset[];
  pickerSlot:SlotId|null;
};

const ACCEPT='image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';
const MAX_BYTES=2*1024*1024;
const SLOTS:SlotDefinition[]=[
  {id:'logo-default',label:'Βασικό λογότυπο',shortLabel:'Βασικό',description:'Η κύρια εικόνα του παρόχου.',role:'logo',variant:'universal',required:true,preview:'neutral'},
  {id:'logo-light',label:'Σε ανοιχτό θέμα',shortLabel:'Ανοιχτό θέμα',description:'Προαιρετική εναλλακτική για ανοιχτό περιβάλλον.',role:'logo',variant:'light',required:false,preview:'light'},
  {id:'logo-dark',label:'Σε σκούρο θέμα',shortLabel:'Σκούρο θέμα',description:'Προαιρετική εναλλακτική για σκούρο περιβάλλον.',role:'logo',variant:'dark',required:false,preview:'dark'},
  {id:'wordmark-default',label:'Βασικό λεκτικό σήμα',shortLabel:'Βασικό',description:'Η κύρια λεκτική υπογραφή ή το πλήρες σήμα.',role:'wordmark',variant:'universal',required:true,preview:'neutral'},
  {id:'wordmark-light',label:'Σε ανοιχτό θέμα',shortLabel:'Ανοιχτό θέμα',description:'Προαιρετική εναλλακτική για ανοιχτό περιβάλλον.',role:'wordmark',variant:'light',required:false,preview:'light'},
  {id:'wordmark-dark',label:'Σε σκούρο θέμα',shortLabel:'Σκούρο θέμα',description:'Προαιρετική εναλλακτική για σκούρο περιβάλλον.',role:'wordmark',variant:'dark',required:false,preview:'dark'},
  {id:'card-default',label:'Βασικό σήμα κάρτας',shortLabel:'Βασικό',description:'Χρησιμοποιείται όταν δεν έχει οριστεί ειδική εικόνα για το φόντο της κάρτας.',role:'card-mark',variant:'universal',required:false,preview:'neutral'},
  {id:'card-light',label:'Σε ανοιχτή κάρτα',shortLabel:'Ανοιχτή κάρτα',description:'Προαιρετική εικόνα για κάρτες με ανοιχτό φόντο.',role:'card-mark',variant:'light',required:false,preview:'light'},
  {id:'card-dark',label:'Σε σκούρα κάρτα',shortLabel:'Σκούρα κάρτα',description:'Προαιρετική εικόνα για κάρτες με σκούρο φόντο.',role:'card-mark',variant:'dark',required:false,preview:'dark'},
];
const SLOT_BY_ID=new Map(SLOTS.map(slot=>[slot.id,slot] as const));
const GROUPS=[
  {title:'Λογότυπο εφαρμογής',description:'Το μικρό σύμβολο που εμφανίζεται κυρίως σε λογαριασμούς και μικρές προβολές.',ids:['logo-default','logo-light','logo-dark'] as SlotId[]},
  {title:'Λεκτικό σήμα εφαρμογής',description:'Η πλήρης λεκτική υπογραφή όπου υπάρχει περισσότερος χώρος.',ids:['wordmark-default','wordmark-light','wordmark-dark'] as SlotId[]},
  {title:'Κάρτες',description:'Η επιλογή γίνεται από το φόντο της ίδιας της κάρτας. Το θέμα της εφαρμογής δεν επηρεάζει τις κάρτες.',ids:['card-default','card-light','card-dark'] as SlotId[]},
];

function emptyAssignments():AssignmentMap{
  return Object.fromEntries(SLOTS.map(slot=>[slot.id,null])) as AssignmentMap;
}
function providerSlug(value:string){
  const greek:Record<string,string>={
    α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o',
  };
  return value.toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').split('').map(char=>greek[char]??char).join('')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);
}
function kindLabel(kind:FinancialProviderKind){
  return kind==='bank'?'Τράπεζα':kind==='fintech'?'Ψηφιακός πάροχος':kind==='wallet'?'Ψηφιακό πορτοφόλι':'Πάροχος πληρωμών';
}
function validateFile(file:File){
  if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type))return 'Υποστηρίζονται PNG, JPG, WebP και SVG.';
  if(!file.size||file.size>MAX_BYTES)return 'Κάθε εικόνα πρέπει να είναι έως 2 MB.';
  return '';
}
function slotId(role:FinancialProviderAssetRole,variant:SlotVariant):SlotId|undefined{
  return SLOTS.find(slot=>slot.role===role&&slot.variant===variant)?.id;
}
function assignmentsForProvider(provider:FinancialProvider){
  const result=emptyAssignments();
  for(const binding of provider.bindings??[]){
    const id=slotId(binding.role,binding.variant);
    if(id)result[id]=binding.assetKey;
  }
  const assetKeys=new Set((provider.assets??[]).map(asset=>asset.assetKey));
  if(!result['logo-default']&&provider.logoAssetKey&&assetKeys.has(provider.logoAssetKey))result['logo-default']=provider.logoAssetKey;
  if(!result['wordmark-default']&&provider.wordmarkAssetKey&&assetKeys.has(provider.wordmarkAssetKey))result['wordmark-default']=provider.wordmarkAssetKey;
  return result;
}
function formatBytes(bytes:number|null|undefined){
  if(!bytes)return '';
  return bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
}
function pendingRef(){
  const value=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `pending:${value}`;
}

export function FinancialProviderManagementSettings(){
  const reduce=useReducedMotion();
  const catalog=useFinancialProviders();
  const providers=catalog.providers;
  const[editor,setEditor]=useState<ProviderEditor|null>(null);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState('');
  const[editorError,setEditorError]=useState('');
  const fileInput=useRef<HTMLInputElement|null>(null);
  const objectUrls=useRef(new Set<string>());
  const releaseEditor=()=>{
    for(const url of objectUrls.current)URL.revokeObjectURL(url);
    objectUrls.current.clear();
    setEditor(null);setEditorError('');
    if(fileInput.current)fileInput.current.value='';
  };
  const closeEditor=()=>{if(!busy)releaseEditor()};
  const closePicker=()=>{if(!busy&&editor?.pickerSlot)setEditor({...editor,pickerSlot:null})};
  const modalRef=useModalFocus<HTMLElement>(Boolean(editor),'[data-autofocus="true"]',closeEditor);
  const pickerRef=useModalFocus<HTMLElement>(Boolean(editor?.pickerSlot),'[data-picker-autofocus="true"]',closePicker);
  const openNew=()=>{
    setMessage('');setEditorError('');
    const assignments=emptyAssignments();
    setEditor({
      source:'new',tab:'details',id:'',displayName:'',shortName:'',providerKind:'bank',countryCode:'GR',
      sortOrder:Math.max(1000,...providers.map(provider=>provider.sortOrder+10)),
      assignments,originalAssignments:{...assignments},pendingAssets:[],pickerSlot:null,
    });
  };
  const openEdit=(provider:FinancialProvider)=>{
    setMessage('');setEditorError('');
    const assignments=assignmentsForProvider(provider);
    setEditor({
      source:'existing',tab:'details',id:provider.id,displayName:provider.displayName,shortName:provider.shortName,
      providerKind:provider.kind,countryCode:provider.countryCode??'',sortOrder:provider.sortOrder,
      assignments,originalAssignments:{...assignments},pendingAssets:[],pickerSlot:null,
    });
  };
  const updateName=(displayName:string)=>{
    if(!editor)return;
    const previousAuto=providerSlug(editor.displayName);
    const id=editor.source==='new'&&(!editor.id||editor.id===previousAuto)?providerSlug(displayName):editor.id;
    setEditor({...editor,displayName,id,shortName:editor.shortName||displayName});
  };
  const providerForEditor=editor?.source==='existing'?providers.find(provider=>provider.id===editor.id):undefined;
  const existingAssets=providerForEditor?.assets??[];

  const resolveAsset=(ref:string|null)=>{
    if(!ref)return null;
    const pending=editor?.pendingAssets.find(asset=>asset.ref===ref);
    if(pending)return {ref,url:pending.previewUrl,name:pending.file.name,meta:`${pending.file.type.replace('image/','').toUpperCase()} · ${formatBytes(pending.file.size)}`,pending:true};
    const asset=existingAssets.find(item=>item.assetKey===ref);
    if(!asset)return null;
    return {ref,url:asset.url,name:asset.fileName||asset.assetKey,meta:[asset.mimeType?.replace('image/','').toUpperCase(),formatBytes(asset.sizeBytes)].filter(Boolean).join(' · '),pending:false};
  };
  const usageCount=(ref:string)=>editor?Object.values(editor.assignments).filter(value=>value===ref).length:0;

  const chooseSlot=(id:SlotId)=>{if(editor)setEditor({...editor,pickerSlot:id})};
  const assign=(id:SlotId,ref:string|null)=>{
    if(!editor)return;
    setEditor({...editor,assignments:{...editor.assignments,[id]:ref},pickerSlot:null});
  };
  const requestUpload=(id:SlotId)=>{
    if(!editor||busy)return;
    setEditor({...editor,pickerSlot:id});
    fileInput.current?.click();
  };
  const handleUpload=(file?:File)=>{
    if(!file||!editor?.pickerSlot)return;
    const error=validateFile(file);
    if(error){setEditorError(error);return}
    const ref=pendingRef();
    const previewUrl=URL.createObjectURL(file);objectUrls.current.add(previewUrl);
    const pending:PendingAsset={ref,file,previewUrl,originSlot:editor.pickerSlot};
    setEditor({...editor,pendingAssets:[...editor.pendingAssets,pending],assignments:{...editor.assignments,[editor.pickerSlot]:ref},pickerSlot:null});
    setEditorError('');
    if(fileInput.current)fileInput.current.value='';
  };

  const validateDetails=()=>{
    if(!editor)return false;
    if(!editor.displayName.trim()||!editor.shortName.trim()||!/^[a-z][a-z0-9-]{0,63}$/.test(editor.id)){
      setEditorError('Συμπλήρωσε όνομα, σύντομο όνομα και έγκυρο Provider ID.');return false;
    }
    if(editor.countryCode.trim()&&!/^[A-Za-z]{2}$/.test(editor.countryCode.trim())){
      setEditorError('Η χώρα πρέπει να είναι διψήφιος ISO κωδικός, π.χ. GR.');return false;
    }
    if(editor.source==='new'&&providers.some(provider=>provider.id===editor.id)){
      setEditorError('Υπάρχει ήδη πάροχος με αυτό το Provider ID.');return false;
    }
    return true;
  };
  const nextToBranding=()=>{
    if(!validateDetails())return;
    setEditorError('');setEditor(current=>current?{...current,tab:'branding'}:current);
  };
  const save=async()=>{
    if(!editor||busy||!validateDetails())return;
    if(!editor.assignments['logo-default']||!editor.assignments['wordmark-default']){
      setEditorError('Στις Εικόνες επίλεξε Βασικό λογότυπο και Βασικό λεκτικό σήμα. Μπορούν να χρησιμοποιούν το ίδιο αρχείο.');
      setEditor({...editor,tab:'branding',pickerSlot:null});return;
    }
    setBusy(true);setEditorError('');
    let created=editor.source==='existing';
    try{
      const payload:FinancialProviderWriteInput={
        id:editor.id,displayName:editor.displayName.trim(),shortName:editor.shortName.trim(),providerKind:editor.providerKind,
        countryCode:editor.countryCode.trim().toUpperCase()||null,sortOrder:editor.sortOrder,
      };
      if(editor.source==='new'){await saveFinancialProvider(payload,false);created=true}
      else await updateFinancialProvider(payload,false);

      const uploaded=new Map<string,string>();
      const referencedPending=new Set(Object.values(editor.assignments).filter((ref):ref is string=>Boolean(ref?.startsWith('pending:'))));
      for(const pending of editor.pendingAssets){
        if(!referencedPending.has(pending.ref))continue;
        if(pending.uploadedKey){uploaded.set(pending.ref,pending.uploadedKey);continue}
        const origin=SLOT_BY_ID.get(pending.originSlot)!;
        const asset=await uploadFinancialProviderAsset({
          providerId:editor.id,role:origin.role,variant:origin.variant,file:pending.file,makePrimary:false,refreshCatalog:false,
        });
        uploaded.set(pending.ref,asset.assetKey);
        pending.uploadedKey=asset.assetKey;
      }

      for(const slot of SLOTS){
        const ref=editor.assignments[slot.id];
        const finalKey=ref?.startsWith('pending:')?(uploaded.get(ref)??editor.pendingAssets.find(item=>item.ref===ref)?.uploadedKey??null):ref;
        const original=editor.originalAssignments[slot.id];
        if(finalKey!==original){
          await setFinancialProviderAssetBinding({providerId:editor.id,role:slot.role,variant:slot.variant,assetKey:finalKey,refreshCatalog:false});
        }
      }
      await refreshFinancialProviders(true);
      setMessage(editor.source==='new'?`Ο πάροχος «${editor.displayName}» δημιουργήθηκε.`:`Ο πάροχος «${editor.displayName}» ενημερώθηκε.`);
      releaseEditor();
    }catch(error){
      if(created&&editor.source==='new')setEditor(current=>current?{...current,source:'existing'}:current);
      setEditorError(userErrorMessage(error,'Δεν ήταν δυνατή η αποθήκευση του παρόχου.'));
    }finally{setBusy(false)}
  };

  const pickerSlot=editor?.pickerSlot?SLOT_BY_ID.get(editor.pickerSlot):undefined;
  const pickerCurrent=editor&&pickerSlot?editor.assignments[pickerSlot.id]:null;
  const library=[
    ...existingAssets.map(asset=>({ref:asset.assetKey,url:asset.url,name:asset.fileName||asset.assetKey,meta:[asset.mimeType?.replace('image/','').toUpperCase(),formatBytes(asset.sizeBytes)].filter(Boolean).join(' · ')})),
    ...(editor?.pendingAssets.map(asset=>({ref:asset.ref,url:asset.previewUrl,name:asset.file.name,meta:`${asset.file.type.replace('image/','').toUpperCase()} · ${formatBytes(asset.file.size)}`}))??[]),
  ];

  return <section className="provider-management panel surface-raised" aria-labelledby="provider-management-title">
    <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={event=>handleUpload(event.target.files?.[0])}/>
    <header className="provider-management-head">
      <div><span className="provider-management-kicker">ΤΡΑΠΕΖΕΣ & ΠΑΡΟΧΟΙ</span><h2 id="provider-management-title">Τράπεζες & πάροχοι</h2><p>Τα στοιχεία και οι εικόνες κάθε παρόχου διαχειρίζονται από την ίδια επεξεργασία.</p></div>
      <Button type="button" variant="secondary" onClick={openNew}><Plus/> Νέος πάροχος</Button>
    </header>

    {message?<div className="provider-management-message" role="status" aria-live="polite">{message}</div>:null}

    <div className="provider-list">{providers.map(provider=>{
      const assets=provider.assets??[],bindings=provider.bindings??[];
      return <article className="provider-list-row" key={provider.id}>
        <div className="provider-list-identity"><span className="provider-list-logo"><BankBrandMark id={provider.id} name={provider.displayName}/></span><div><b>{provider.displayName}</b><span>{kindLabel(provider.kind)} · {provider.id}</span></div></div>
        <div className="provider-list-summary">
          <span><Images size={15}/>{assets.length} {assets.length===1?'εικόνα':'εικόνες'}</span>
          <span>{bindings.length} χρήσεις</span>
          <div className="provider-list-thumbs">{assets.slice(0,3).map(asset=><span key={asset.assetKey}><img src={asset.url} alt="" draggable={false}/></span>)}</div>
        </div>
        <Button type="button" variant="secondary" className="provider-edit-action" onClick={()=>openEdit(provider)}><Pencil size={15}/> Επεξεργασία</Button>
      </article>;
    })}</div>

    <AnimatePresence>{editor?<motion.div className="provider-editor-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={closeEditor}>
      <motion.section ref={modalRef} className="provider-editor-modal" role="dialog" aria-modal="true" aria-labelledby="provider-editor-title" tabIndex={-1} initial={reduce?false:{opacity:0,scale:.98,y:10}} animate={{opacity:1,scale:1,y:0}} exit={reduce?undefined:{opacity:0,scale:.985,y:6}} transition={{duration:reduce?0:.18}} onMouseDown={event=>event.stopPropagation()}>
        <header className="provider-editor-header">
          <div><span>{editor.source==='new'?'ΝΕΟΣ ΠΑΡΟΧΟΣ':'ΕΠΕΞΕΡΓΑΣΙΑ ΠΑΡΟΧΟΥ'}</span><h2 id="provider-editor-title">{editor.source==='new'?(editor.displayName||'Νέος πάροχος'):editor.displayName}</h2></div>
          <IconButton type="button" aria-label="Κλείσιμο" disabled={busy} onClick={closeEditor}><X/></IconButton>
        </header>

        <div className="provider-editor-tabs" role="tablist" aria-label="Επεξεργασία παρόχου">
          <button type="button" role="tab" aria-selected={editor.tab==='details'} className={editor.tab==='details'?'active':''} onClick={()=>setEditor({...editor,tab:'details',pickerSlot:null})}>Στοιχεία</button>
          <button type="button" role="tab" aria-selected={editor.tab==='branding'} className={editor.tab==='branding'?'active':''} onClick={()=>{if(editor.source==='new'&&!validateDetails())return;setEditor({...editor,tab:'branding',pickerSlot:null});setEditorError('')}}>Εικόνες</button>
        </div>

        <div className="provider-editor-body">
          {editor.tab==='details'?<div className="provider-details-panel" role="tabpanel">
            <div className="provider-details-grid">
              <label><span>Όνομα</span><AppTextInput data-autofocus="true" value={editor.displayName} onChange={event=>updateName(event.target.value)} placeholder="π.χ. Νέα Τράπεζα"/></label>
              <label><span>Σύντομο όνομα</span><AppTextInput value={editor.shortName} onChange={event=>setEditor({...editor,shortName:event.target.value})} placeholder="π.χ. Νέα"/></label>
              <label><span>Τύπος</span><AppSelectInput aria-label="Τύπος παρόχου" value={editor.providerKind} onChange={event=>setEditor({...editor,providerKind:event.target.value as FinancialProviderKind})}><option value="bank">Τράπεζα</option><option value="fintech">Ψηφιακός πάροχος</option><option value="wallet">Ψηφιακό πορτοφόλι</option><option value="payment">Πάροχος πληρωμών</option></AppSelectInput></label>
              <label><span>Χώρα (ISO)</span><AppTextInput maxLength={2} value={editor.countryCode} onChange={event=>setEditor({...editor,countryCode:event.target.value.toUpperCase()})} placeholder="GR"/></label>
            </div>
            <div className="provider-id-field"><span>Provider ID</span>{editor.source==='new'?<AppTextInput value={editor.id} onChange={event=>setEditor({...editor,id:providerSlug(event.target.value)})} placeholder="nea-trapeza"/>:<code>{editor.id}</code>}<small>{editor.source==='new'?'Σταθερό τεχνικό αναγνωριστικό. Μετά τη δημιουργία δεν αλλάζει.':'Το Provider ID παραμένει σταθερό ώστε να μη σπάνε λογαριασμοί και κάρτες.'}</small></div>
          </div>:<div className="provider-branding-panel" role="tabpanel">
            <div className="provider-branding-intro"><div><h3>Εικόνες παρόχου</h3><p>Ανέβασε κάθε αρχείο μία φορά και χρησιμοποίησέ το σε όσες θέσεις χρειάζεται. Οι ειδικές εικόνες ανά θέμα ή κάρτα είναι προαιρετικές.</p></div><span className="provider-library-count"><Images size={15}/>{library.length} στη βιβλιοθήκη</span></div>

            {GROUPS.map(group=><section className="provider-brand-group" key={group.title}>
              <header><h4>{group.title}</h4><p>{group.description}</p></header>
              <div className="provider-slot-grid">{group.ids.map(id=>{const slot=SLOT_BY_ID.get(id)!,ref=editor.assignments[id],asset=resolveAsset(ref),uses=ref?usageCount(ref):0;return <article className="provider-slot-card" key={id}>
                <div className={`provider-slot-preview ${slot.preview}`}>{asset?<img src={asset.url} alt="" draggable={false}/>:<ImagePlus aria-hidden="true"/>}</div>
                <div className="provider-slot-copy"><div><b>{slot.label}</b>{slot.required?<span className="required-badge">Απαραίτητο</span>:null}</div><p>{slot.description}</p>{asset?<small title={asset.name}>{asset.name}{uses>1?` · χρησιμοποιείται σε ${uses} θέσεις`:''}</small>:<small>{slot.required?'Δεν έχει επιλεγεί εικόνα':'Χρήση βασικής εικόνας'}</small>}</div>
                <button type="button" className="provider-slot-select" disabled={busy} onClick={()=>chooseSlot(id)}>{asset?'Αλλαγή':'Επιλογή εικόνας'}</button>
              </article>})}</div>
            </section>)}

            {library.length?<section className="provider-library"><header><div><h4>Βιβλιοθήκη εικόνων</h4><p>Όλα τα ήδη ανεβασμένα assets του παρόχου. Η ίδια εικόνα μπορεί να ανατεθεί σε πολλές θέσεις.</p></div></header><div className="provider-library-strip">{library.map(asset=><div className="provider-library-item" key={asset.ref}><span><img src={asset.url} alt="" draggable={false}/></span><div><b title={asset.name}>{asset.name}</b><small>{usageCount(asset.ref)} {usageCount(asset.ref)===1?'χρήση':'χρήσεις'}</small></div></div>)}</div></section>:null}
          </div>}

          {editorError?<div className="provider-editor-error form-error" role="alert" aria-live="assertive">{editorError}</div>:null}
        </div>

        <footer className="provider-editor-footer">
          <Button type="button" variant="secondary" disabled={busy} onClick={closeEditor}>Ακύρωση</Button>
          {editor.source==='new'&&editor.tab==='details'
            ?<Button type="button" variant="primary" disabled={busy} onClick={nextToBranding}>Συνέχεια στις εικόνες</Button>
            :<Button type="button" variant="primary" disabled={busy} onClick={()=>void save()}>{busy?'Αποθήκευση…':editor.source==='new'?'Δημιουργία παρόχου':'Αποθήκευση'}</Button>}
        </footer>

        {pickerSlot?<div className="provider-asset-picker-scrim" onMouseDown={()=>setEditor({...editor,pickerSlot:null})}>
          <section ref={pickerRef} className="provider-asset-picker" role="dialog" aria-modal="true" aria-label={`Επιλογή εικόνας για ${pickerSlot.label}`} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}>
            <header><div><span>ΕΠΙΛΟΓΗ ΕΙΚΟΝΑΣ</span><h3>{pickerSlot.label}</h3><p>Διάλεξε από τη βιβλιοθήκη ή ανέβασε νέο αρχείο.</p></div><IconButton type="button" aria-label="Κλείσιμο επιλογής εικόνας" onClick={()=>setEditor({...editor,pickerSlot:null})}><X/></IconButton></header>
            <div className="provider-asset-picker-grid">
              <button type="button" data-picker-autofocus="true" className="provider-picker-upload" onClick={()=>requestUpload(pickerSlot.id)}><Upload/><b>Ανέβασμα νέας</b><small>PNG, JPG, WebP ή SVG · έως 2 MB</small></button>
              {!pickerSlot.required?<button type="button" className={!pickerCurrent?'provider-picker-none selected':'provider-picker-none'} onClick={()=>assign(pickerSlot.id,null)}><span><ImagePlus/></span><b>Χωρίς override</b><small>Χρήση της προεπιλεγμένης εικόνας</small>{!pickerCurrent?<Check className="provider-picker-check"/>:null}</button>:null}
              {library.map(asset=>{const uses=usageCount(asset.ref),selected=pickerCurrent===asset.ref;return <button type="button" className={selected?'provider-picker-asset selected':'provider-picker-asset'} key={asset.ref} onClick={()=>assign(pickerSlot.id,asset.ref)}>
                <span className={`provider-picker-preview ${pickerSlot.preview}`}><img src={asset.url} alt="" draggable={false}/></span>
                <b title={asset.name}>{asset.name}</b><small>{asset.meta||'Ανεβασμένη εικόνα'}{uses?` · ${uses} ${uses===1?'χρήση':'χρήσεις'}`:''}</small>{selected?<Check className="provider-picker-check"/>:null}
              </button>})}
            </div>
          </section>
        </div>:null}
      </motion.section>
    </motion.div>:null}</AnimatePresence>
  </section>;
}
