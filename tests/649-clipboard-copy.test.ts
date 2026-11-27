import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { copyTextWithFallback } from '../src/lib/copyTextWithFallback.js';

const stack=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
const iban=readFileSync(new URL('../src/components/AccountIban.tsx',import.meta.url),'utf8');
const paymentCard=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
const ibanBrowserQa=readFileSync(new URL('../scripts/account-metadata-qa.mjs',import.meta.url),'utf8');
const ibanStyles=readFileSync(new URL('../src/styles/account-iban-surfaces.css',import.meta.url),'utf8');

afterEach(()=>vi.unstubAllGlobals());

function emulateLegacyCopy(result:'success'|'false'|'throw'){
  const node={value:'',readOnly:false,style:{position:'',opacity:''},select:vi.fn(),remove:vi.fn()};
  const fakeDocument={
    createElement:vi.fn(()=>node),
    body:{appendChild:vi.fn()},
    execCommand:vi.fn(()=>{
      if(result==='throw')throw new Error('copy blocked');
      return result==='success';
    }),
  };
  vi.stubGlobal('document',fakeDocument);
  return {node,fakeDocument};
}

describe('#649 sensitive clipboard copy and truthful feedback',()=>{
  it('cancels obsolete credit-card reveal after a pending vault read and does not expose it on a later restack',()=>{
    const reveal=stack.slice(stack.indexOf('async function toggleReveal('),stack.indexOf('async function copyField('));
    const load=stack.slice(stack.indexOf('async function loadSecrets('),stack.indexOf('function renderCard('));
    const creditQa=readFileSync(new URL('../scripts/credit-stack-remediation-qa.mjs',import.meta.url),'utf8');
    const guard='if(!effectActive||!currentCard(id)||orderRef.current[0]!==id||!cardEl.isConnected)return;';
    expect(reveal.indexOf(guard)).toBeGreaterThan(reveal.indexOf('await loadSecrets(card)'));
    expect(reveal.indexOf(guard)).toBeLessThan(reveal.indexOf('revealedRef.current.add(id)'));
    expect(load).toContain('if(effectActive&&currentCard(card.id)&&orderRef.current[0]===card.id)announce(cardVaultErrorMessage(error)');
    expect(creditQa).toContain('Sensitive credit-stack stale pending-vault reveal must remain masked after restack');
    expect(creditQa).toContain('credit-stack-stale-vault-reveal-cancelled-desktop');
    expect(creditQa).toContain('staleRevealMasked');
  });

  it('cancels an obsolete credit card vault read before copying after restack/unmount',()=>{
    const credit=readFileSync(new URL('../scripts/credit-stack-remediation-qa.mjs',import.meta.url),'utf8');
    const code=stack.slice(stack.indexOf('async function copyField('),stack.indexOf('function bindTopCard()'));
    expect(stack).toContain('let effectActive=true;');
    expect(code).toContain('if(!effectActive||!currentCard(id)||orderRef.current[0]!==id)return;');
    expect(code.indexOf('if(!effectActive||!currentCard(id)||orderRef.current[0]!==id)return;')).toBeLessThan(code.indexOf('await copyTextWithFallback(value)'));
    expect(stack).toContain('return()=>{effectActive=false;stage.removeEventListener');
    expect(code).toContain("if(effectActive&&currentCard(id)&&orderRef.current[0]===id)announce('Αντιγράφηκε')");
    expect(credit).toContain('Sensitive credit-stack stale-card pending-vault copy is cancelled before clipboard after restack');
    expect(credit).toContain('staleCopyOutcome.writes===0');
    expect(credit).toContain('credit-stack-stale-card-copy-cancelled-desktop');
  });


  it('stages actual debit and credit desktop/mobile sensitive copy denial and single-flight browser proof',()=>{
    const debit=readFileSync(new URL('../scripts/cards-remediation-qa.mjs',import.meta.url),'utf8');
    const credit=readFileSync(new URL('../scripts/credit-stack-remediation-qa.mjs',import.meta.url),'utf8');
    for(const suite of [debit,credit]){
      expect(suite).toContain('clipboard single-flight');
      expect(suite).toContain('document.execCommand=()=>false');
      expect(suite).toContain('document.execCommand=()=>false');
    }
    expect(debit).toContain('button?.click();button?.click()');
    expect(credit).toContain('b?.click();b?.click()');
    expect(debit).toContain('cards-sensitive-copy-singleflight-mobile');
    expect(credit).toContain('credit-stack-sensitive-copy-singleflight-mobile');
    expect(debit).toContain('globalThis.__qaCardSensitiveCopy?.copies===2');
    expect(credit).toContain('globalThis.__qaCreditSensitiveCopy?.copies===2');
  });


  it('serializes payment-card PAN/expiry/CVV copy before vault/clipboard awaits and ignores stale stack card result',()=>{
    expect(paymentCard).toContain('const copyInFlight=useRef(false)');
    expect(paymentCard).toContain('const [copyBusy,setCopyBusy]=useState(false)');
    const direct=paymentCard.slice(paymentCard.indexOf('const copy=async(field:keyof Secrets,label:string)=>'),paymentCard.indexOf('const setArchiveProgress='));
    expect(direct).toContain('if(busy||copyInFlight.current||!isActiveCard(requestedId))return');
    expect(direct.indexOf('copyInFlight.current=true')).toBeLessThan(direct.indexOf('await loadSecrets()'));
    expect(direct).toContain("setCopyBusy(true);setMessage('')");
    expect(direct).toContain('copyInFlight.current=false;');
    expect(direct).toContain('if(mountedRef.current&&activeCardIdRef.current===requestedId)setCopyBusy(false)');
    expect(direct).toContain("setMessageTone('error');setMessage('Δεν ήταν δυνατή η αντιγραφή.')");
    expect(paymentCard.match(/className="copy-mini" type="button" disabled=\{busy\|\|copyBusy\}/g)).toHaveLength(3);
    const canonical=stack.slice(stack.indexOf('async function copyField('),stack.indexOf('function bindTopCard()'));
    expect(stack).toContain('let copyInFlight=false;');
    expect(canonical).toContain('if(copyInFlight)return;');
    expect(canonical.indexOf('copyInFlight=true')).toBeLessThan(canonical.indexOf('await loadSecrets(card)'));
    expect(canonical).toContain("copyInFlight=true;announce('')");
    // The pending vault result must be discarded before touching the clipboard
    // if the original card ceased to be top/current, or the stack unmounted.
    const staleGuard=canonical.indexOf('if(!effectActive||!currentCard(id)||orderRef.current[0]!==id)return;');
    const clipboardCall=canonical.indexOf('await copyTextWithFallback(value)');
    expect(staleGuard).toBeGreaterThan(canonical.indexOf('await loadSecrets(card)'));
    expect(clipboardCall).toBeGreaterThan(staleGuard);
    expect(canonical).toContain("if(effectActive&&currentCard(id)&&orderRef.current[0]===id)announce('Αντιγράφηκε')");
    expect(canonical).toContain("if(effectActive&&currentCard(id)&&orderRef.current[0]===id)announce('Δεν ήταν δυνατή η αντιγραφή','error')");
    expect(canonical).toContain('finally{copyInFlight=false}');
  });


  it('blocks a stale debit/prepaid vault result before revealing or copying after route unmount',()=>{
    const load=paymentCard.slice(paymentCard.indexOf('const loadSecrets=async()=>'),paymentCard.indexOf('const toggleReveal=async()=>'));
    const direct=paymentCard.slice(paymentCard.indexOf('const copy=async(field:keyof Secrets,label:string)=>'),paymentCard.indexOf('const setArchiveProgress='));
    const qa=readFileSync(new URL('../scripts/cards-remediation-qa.mjs',import.meta.url),'utf8');
    expect(paymentCard).toContain('const mountedRef=useRef(false)');
    expect(paymentCard).toContain('const activeCardIdRef=useRef(card.id)');
    expect(paymentCard).toContain('useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false}},[])');
    expect(load.indexOf('if(!isActiveCard(requestedId))return null;')).toBeGreaterThan(load.indexOf('await revealCardSecret(requestedId)'));
    expect(load.indexOf('if(!isActiveCard(requestedId))return null;')).toBeLessThan(load.indexOf('setRevealed(server)'));
    const guard=direct.indexOf('if(!isActiveCard(requestedId))return;');
    expect(guard).toBeGreaterThan(direct.indexOf('await loadSecrets()'));
    expect(guard).toBeLessThan(direct.indexOf('await copyTextWithFallback(current)'));
    expect(direct).toContain('if(isActiveCard(requestedId)){setMessageTone(\'success\')');
    expect(direct).toContain('if(isActiveCard(requestedId)){setMessageTone(\'error\')');
    expect(qa).toContain('Sensitive debit/prepaid pending vault read canceled after route unmount');
    expect(qa).toContain('staleVault.writes===0');
    expect(qa).toContain('cards-sensitive-copy-unmounted-cancelled-desktop');
  });

  it('serializes IBAN copy attempts before React repaint, clears stale status and old success timer',()=>{
    expect(iban).toContain('const copyInFlight=useRef(false)');
    expect(iban).toContain('const successResetTimer=useRef<number|null>(null)');
    expect(iban).toContain('if(!iban||copyInFlight.current)return;');
    const owner=iban.slice(iban.indexOf('const copy=async()=>'),iban.indexOf('return <div'));
    expect(owner.indexOf('copyInFlight.current=true')).toBeLessThan(owner.indexOf('await copyTextWithFallback(iban)'));
    expect(owner).toContain('setCopied(false);setCopyError(false)');
    expect(owner).toContain('window.clearTimeout(successResetTimer.current)');
    expect(owner).toContain('finally{copyInFlight.current=false}');
    expect(iban).toContain('window.clearTimeout(successResetTimer.current)},[])');
    expect(ibanBrowserQa).toContain('IBAN same-turn clipboard copy single-flight');
    expect(ibanBrowserQa).toContain('clipboardRequests===1');
    expect(ibanBrowserQa).toContain('account-metadata-clipboard-singleflight-desktop');
  });


  it('uses the native API without creating a hidden field when it succeeds',async()=>{
    const writeText=vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator',{clipboard:{writeText}});
    const {fakeDocument}=emulateLegacyCopy('success');
    await copyTextWithFallback('fixture-only');
    expect(writeText).toHaveBeenCalledWith('fixture-only');
    expect(fakeDocument.createElement).not.toHaveBeenCalled();
  });

  it('on denied native clipboard permission uses a successful fallback and securely clears the field',async()=>{
    const writeText=vi.fn().mockRejectedValue(new Error('permission denied'));
    vi.stubGlobal('navigator',{clipboard:{writeText}});
    const {node,fakeDocument}=emulateLegacyCopy('success');
    await expect(copyTextWithFallback('fixture-only')).resolves.toBeUndefined();
    expect(fakeDocument.execCommand).toHaveBeenCalledWith('copy');
    expect(node.select).toHaveBeenCalledOnce();
    expect(node.readOnly).toBe(true);
    expect(node.value).toBe('');
    expect(node.remove).toHaveBeenCalledOnce();
  });

  it.each(['false','throw'] as const)('never claims success when fallback is %s and clears DOM',async scenario=>{
    vi.stubGlobal('navigator',{clipboard:undefined});
    const {node}=emulateLegacyCopy(scenario);
    await expect(copyTextWithFallback('fixture-only')).rejects.toThrow();
    expect(node.value).toBe('');
    expect(node.remove).toHaveBeenCalledOnce();
  });

  it('does not leave a temporary value if the select operation itself throws',async()=>{
    vi.stubGlobal('navigator',{clipboard:undefined});
    const {node}=emulateLegacyCopy('success');
    node.select.mockImplementationOnce(()=>{throw new Error('cannot select')});
    await expect(copyTextWithFallback('fixture-only')).rejects.toThrow('cannot select');
    expect(node.value).toBe('');
    expect(node.remove).toHaveBeenCalledOnce();
  });

  it('guards canonical card, interactive card and IBAN copy through the shared implementation',()=>{
    for(const consumer of [stack,iban,paymentCard])expect(consumer).toContain('copyTextWithFallback(');
    expect(stack).not.toContain("document.execCommand('copy')");
    expect(iban).not.toContain("document.execCommand('copy')");
    expect(stack).toContain("announce('Δεν ήταν δυνατή η αντιγραφή','error')");
    expect(stack).toContain("tone==='error'?'alert':'status'");
    expect(iban).toContain('role="alert" aria-live="assertive"');
    expect(iban).toContain('data-copy-error={copyError||undefined}');
    expect(iban).toContain('copyError?<X size={14} aria-hidden="true"/>');
    expect(ibanStyles).toContain('.account-iban .account-iban-copy[data-copy-error="true"]');
    expect(ibanBrowserQa).toContain('copyFailure.errorControl');
    expect(paymentCard).toContain('<OperationFeedback className="r-card-status" tone={messageTone}>');
    expect(paymentCard).toContain("setMessageTone('error');setMessage('Δεν ήταν δυνατή η αντιγραφή.')");
    expect(paymentCard).not.toContain('setMessage(current)');
    expect(ibanBrowserQa).toContain('account-metadata-clipboard-denied-desktop');
    expect(ibanBrowserQa).toContain('copy rejection never reports success or leaves account identifier');
  });
});
