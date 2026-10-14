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
// The catalog path is a closed, same-origin allowlist, never interpolated from
// persisted user settings or a category name.
const CATALOG_FILES:Readonly<Record<CategoryIconPack,Readonly<{svg:string;json:string}>>>={
  lucide:{svg:'/icon-packs/lucide.svg',json:'/icon-packs/lucide.json'},
  tabler:{svg:'/icon-packs/tabler.svg',json:'/icon-packs/tabler.json'},
  phosphor:{svg:'/icon-packs/phosphor.svg',json:'/icon-packs/phosphor.json'},
  heroicons:{svg:'/icon-packs/heroicons.svg',json:'/icon-packs/heroicons.json'},
  bootstrap:{svg:'/icon-packs/bootstrap.svg',json:'/icon-packs/bootstrap.json'},
};
export const iconCatalogAsset=(pack:CategoryIconPack,ext:'svg'|'json')=>CATALOG_FILES[pack][ext];
