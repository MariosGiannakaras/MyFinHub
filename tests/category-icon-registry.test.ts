import { describe, expect, it } from 'vitest';
import { CATEGORY_ICON_REGISTRY, categoryIconByKey, searchCategoryIcons } from '../src/lib/categoryIconRegistry.js';

describe('local category icon registry',()=>{
  it('ships a broad stable local registry with unique keys',()=>{
    expect(CATEGORY_ICON_REGISTRY.length).toBeGreaterThanOrEqual(75);
    expect(new Set(CATEGORY_ICON_REGISTRY.map(item=>item.key)).size).toBe(CATEGORY_ICON_REGISTRY.length);
    expect(CATEGORY_ICON_REGISTRY.every(item=>item.label&&item.key&&!JSON.stringify(item).match(/https?:\/\//))).toBe(true);
  });

  it('searches Greek and English synonyms without requiring accents',()=>{
    expect(searchCategoryIcons('φαρμακειο').map(item=>item.key)).toContain('pharmacy');
    expect(searchCategoryIcons('supermarket').map(item=>item.key)).toContain('groceries');
    expect(searchCategoryIcons('τσιγαρα').map(item=>item.key)).toContain('tobacco');
    expect(searchCategoryIcons('travel').map(item=>item.key)).toContain('travel');
  });

  it('resolves stable keys and fails safely for retired or unknown keys',()=>{
    expect(categoryIconByKey('coffee')?.label).toBe('Καφές');
    expect(categoryIconByKey('does-not-exist')).toBeNull();
  });
});
