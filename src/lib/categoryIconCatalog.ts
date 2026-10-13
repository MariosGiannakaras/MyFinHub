/* Static availability manifest for generated offline, deduplicated SVG packs. 
 * Source and regeneration contract: docs/ICON_CATALOG_SOURCES.md.
 * The complete search lists live under public/icon-packs/*.json and load only on demand.
 */
import type { CategoryIconPack } from './categoryIconRegistry.js';

export const CATEGORY_ICON_CATALOG_COUNTS: Readonly<Record<CategoryIconPack,number>> = {
  "lucide": 1876,
  "tabler": 5166,
  "phosphor": 1512,
  "heroicons": 322,
  "bootstrap": 1404
};

/** New catalog keys never collide with existing semantic keys/persisted legacy values. */
export const isCatalogIconKey=(key:string):boolean=>/^icon\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);
export const iconCatalogAsset=(pack:CategoryIconPack,ext:'svg'|'json')=>`/icon-packs/${pack}.${ext}`;
