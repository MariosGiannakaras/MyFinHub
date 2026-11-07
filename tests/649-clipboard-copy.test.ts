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
