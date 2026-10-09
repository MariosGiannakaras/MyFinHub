import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/RecurringPage.tsx',import.meta.url),'utf8');
const context=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');
const mark=readFileSync(new URL('../src/components/RecurringBrandMark.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/lib/recurringServiceAssetClient.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/recurring-approved-target.css',import.meta.url),'utf8');

describe('Recurring service-brand integration contracts',()=>{
  it('keeps upload deferred until recurring Save and makes Cancel network-free',()=>{
    expect(page).toContain("const selectLogo=(file?:File)=>");
    expect(page).toContain('setEditLogoFile(file)');
    expect(page).not.toContain('URL.createObjectURL');
    expect(page).toContain('data-recurring-brand-source="local-selection"');
    expect(page).toContain("const save=async()=>");
    expect(page).toContain('uploaded=await uploadRecurringServiceAsset({recurringId:base.id,file:editLogoFile})');
    expect(page).toContain("const closeEdit=()=>{if(!editBusy)releaseEdit()}");
    expect(page).not.toMatch(/const selectLogo=.*uploadRecurringServiceAsset/);
  });

  it('supports add, replace and remove with stable logoAssetKey only',()=>{
    expect(page).toContain("logoAssetKey=editLogoRemoved?undefined:base.logoAssetKey");
    expect(page).toContain('logoAssetKey=uploaded.assetKey');
    expect(page).toContain('const normalized:RecurringItem={...base,logoAssetKey:logoAssetKey||undefined}');
    expect(page).toContain("const removeLogo=()=>{setEditLogoFile(null);setEditLogoRemoved(true)");
    expect(page).toContain("Ανέβασμα");
    expect(page).toContain("Αλλαγή");
    expect(page).toContain("Αφαίρεση");
    expect(page).not.toMatch(/base64|data:image/);
    expect(page).not.toContain('editLogoPreview');
  });

  it('cleans up a newly uploaded asset when the synchronous recurring save fails',()=>{
    expect(page).toContain('if(uploaded){try{await deleteRecurringServiceAsset(uploaded.assetKey)}catch{}}');
    expect(client).toContain("method:'DELETE'");
  });

  it('uses one shared service brand renderer for active, mobile, inactive and payment-flow identities',()=>{
    expect(page.match(/<RecurringBrandMark item=\{item\}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(context).toContain("context.mode==='recurring'&&recurring?<RecurringBrandMark item={recurring}");
    expect(mark).toContain('recurringServiceAssetByKey(assetKey)');
    expect(mark).toContain('<FinanceIcon');
    expect(mark).toContain('data-recurring-brand-source="service-storage"');
    expect(css).toContain('.recurring-logo-editor');
    expect(css).toContain('.contextual-quick-modal #context-quick-title');
  });

  it('preserves service branding across lifecycle transitions without rewriting financial history',()=>{
    expect(page).toContain("onUpsert({...item,status,active:status==='active'})");
    expect(page).not.toMatch(/setLifecycle=.*logoAssetKey/);
    expect(page).not.toMatch(/setLifecycle=.*events/);
  });

  it('keeps service assets separate from the financial-provider registry',()=>{
    expect(client).toContain("resource:'recurring-service-assets'");
    expect(client).not.toContain('financial-providers');
    expect(mark).not.toContain('BankBrandMark');
  });
});
