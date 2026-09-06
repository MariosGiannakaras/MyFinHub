import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ICON_PACKS,
  CATEGORY_ICON_REGISTRY,
  categoryIconByKey,
  decodeCategoryIconValue,
  encodeCategoryIconValue,
  searchCategoryIcons,
} from '../src/lib/categoryIconRegistry.js';

describe('local category icon registry',()=>{
  it('ships a broad stable local registry with unique keys',()=>{
    expect(CATEGORY_ICON_REGISTRY.length).toBeGreaterThanOrEqual(75);
    expect(new Set(CATEGORY_ICON_REGISTRY.map(item=>item.key)).size).toBe(CATEGORY_ICON_REGISTRY.length);
    expect(CATEGORY_ICON_REGISTRY.every(item=>item.label&&item.key&&!JSON.stringify(item).match(/https?:\/\//))).toBe(true);
  });

  it('exposes five connected free icon packs without breaking legacy Lucide values',()=>{
    expect(CATEGORY_ICON_PACKS.map(item=>item.id)).toEqual(['lucide','tabler','phosphor','heroicons','bootstrap']);
    expect(CATEGORY_ICON_PACKS.map(item=>item.license)).toEqual(['ISC','MIT','MIT','MIT','MIT']);
    expect(encodeCategoryIconValue('lucide','coffee')).toBe('coffee');
    expect(encodeCategoryIconValue('tabler','coffee')).toBe('tabler:coffee');
    expect(encodeCategoryIconValue('phosphor','coffee')).toBe('phosphor:coffee');
    expect(encodeCategoryIconValue('heroicons','coffee')).toBe('heroicons:coffee');
    expect(encodeCategoryIconValue('bootstrap','coffee')).toBe('bootstrap:coffee');
    expect(decodeCategoryIconValue('coffee')).toEqual({pack:'lucide',key:'coffee'});
    expect(decodeCategoryIconValue('tabler:coffee')).toEqual({pack:'tabler',key:'coffee'});
    expect(decodeCategoryIconValue('phosphor:coffee')).toEqual({pack:'phosphor',key:'coffee'});
    expect(decodeCategoryIconValue('heroicons:coffee')).toEqual({pack:'heroicons',key:'coffee'});
    expect(decodeCategoryIconValue('bootstrap:coffee')).toEqual({pack:'bootstrap',key:'coffee'});
  });

  it('searches Greek and English synonyms without requiring accents',()=>{
    expect(searchCategoryIcons('φαρμακειο').map(item=>item.key)).toContain('pharmacy');
    expect(searchCategoryIcons('supermarket').map(item=>item.key)).toContain('groceries');
    expect(searchCategoryIcons('τσιγαρα').map(item=>item.key)).toContain('tobacco');
    expect(searchCategoryIcons('travel').map(item=>item.key)).toContain('travel');
  });

  it('resolves stable keys across packs and fails safely for retired or unknown keys',()=>{
    expect(categoryIconByKey('coffee')?.label).toBe('Καφές');
    expect(categoryIconByKey('tabler:coffee')?.label).toBe('Καφές');
    expect(categoryIconByKey('phosphor:coffee')?.label).toBe('Καφές');
    expect(categoryIconByKey('heroicons:coffee')?.label).toBe('Καφές');
    expect(categoryIconByKey('bootstrap:coffee')?.label).toBe('Καφές');
    expect(categoryIconByKey('does-not-exist')).toBeNull();
  });
});
