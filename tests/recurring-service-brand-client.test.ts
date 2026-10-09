import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRecurringServiceAsset } from '../src/lib/recurringServiceAssetClient.js';

const client=readFileSync('src/lib/recurringServiceAssetClient.ts','utf8');
const component=readFileSync('src/components/RecurringBrandMark.tsx','utf8');
const hook=readFileSync('src/hooks/useRecurringServiceAssets.ts','utf8');
const css=readFileSync('src/styles/recurring-brand-mark.css','utf8');
const urlGuard=readFileSync('src/lib/providerAssetUrl.ts','utf8');

describe('recurring service brand client and shared renderer',()=>{
  it('accepts only the canonical service-asset shape and safe public URL',()=>{
    expect(parseRecurringServiceAsset({
      assetKey:'service-asset-1234567890abcdef12345678',
      recurringId:'rec-netflix',
      url:'https://project.example/storage/v1/object/public/recurring-service-assets/services/logo.svg',
      fileName:'netflix.svg',
      mimeType:'image/svg+xml',
      sizeBytes:512,
      updatedAt:'2026-10-08T00:00:00.000Z',
    })?.recurringId).toBe('rec-netflix');
    expect(parseRecurringServiceAsset({
      assetKey:'provider-logo',
      recurringId:'rec-netflix',
      url:'https://project.example/logo.svg',
      fileName:'netflix.svg',
      mimeType:'image/svg+xml',
      sizeBytes:512,
      updatedAt:'2026-10-08T00:00:00.000Z',
    })).toBeNull();
    expect(parseRecurringServiceAsset({
      assetKey:'service-asset-1234567890abcdef12345678',
      recurringId:'rec-netflix',
      url:'javascript:alert(1)',
      fileName:'netflix.svg',
      mimeType:'image/svg+xml',
      sizeBytes:512,
      updatedAt:'2026-10-08T00:00:00.000Z',
    })).toBeNull();
  });

  it('keeps the service asset API separate from financial-provider registry semantics',()=>{
    expect(client).toContain("resource:'recurring-service-assets'");
    expect(client).toContain("method:'PUT'");
    expect(client).toContain("method:'DELETE'");
    expect(client).not.toContain('financial-providers');
    expect(component).not.toContain('BankBrandMark');
  });

  it('uses one shared renderer with contain-fit artwork and category-icon fallback',()=>{
    expect(component).toContain('data-recurring-brand-source="service-storage"');
    expect(component).toContain('onError={()=>setFailedAssetKey(asset.assetKey)}');
    expect(component).toContain('<FinanceIcon');
    expect(css).toContain('object-fit:contain');
    expect(css).toContain('background:var(--surface-2)');
    expect(css).toContain('overflow:hidden');
  });

  it('does not fetch service assets for no-logo recurring items',()=>{
    expect(component).toContain('const assetKey=item.logoAssetKey?.trim()||null');
    expect(component).toContain('useRecurringServiceAssets(Boolean(assetKey))');
    expect(hook).toContain('export function useRecurringServiceAssets(enabled=true)');
    expect(hook).toContain('if(enabled&&!snapshot.loaded&&!snapshot.loading)');
  });

  it('generalizes the existing HTTPS/local asset URL guard without breaking provider callers',()=>{
    expect(urlGuard).toContain('export function publicAssetUrlAllowed');
    expect(urlGuard).toContain('export const providerAssetUrlAllowed=publicAssetUrlAllowed');
  });
});
