# Offline, genuinely distinct category icon catalogs

Source: [Iconify open-source icon-sets](https://github.com/iconify/icon-sets), **pinned immutable commit** `c455eb6232ac0fa657550afb512af55fb8237ed6` (2026-10-13). The source JSON is an optimized, sanitized derivative of each original open-source icon family; raw SVG and searchable names are checked into MyFinHub's public/icon-packs folder. No CDN, external requests or new npm packages are involved at runtime.

| Family | Source set | Iconify source version | License | Unique catalog SVGs |
| --- | --- | --- | --- | ---: |
| lucide | `json/lucide.json` | Lucide snapshot | ISC | 1876 |
| tabler | `json/tabler.json` | Tabler snapshot | MIT | 5166 |
| phosphor | `json/ph.json` | Phosphor snapshot | MIT | 1512 |
| heroicons | `json/heroicons.json` | Heroicons snapshot | MIT | 322 |
| bootstrap | `json/bi.json` | Bootstrap Icons snapshot | MIT | 1404 |

Upstream rights/attribution:
- Lucide: https://github.com/lucide-icons/lucide/blob/main/LICENSE — ISC.
- Tabler: https://github.com/tabler/tabler-icons/blob/main/LICENSE — MIT, Paweł Kuna.
- Phosphor: https://github.com/phosphor-icons/core/blob/main/LICENSE — MIT.
- Heroicons: https://github.com/tailwindlabs/heroicons/blob/master/LICENSE — MIT.
- Bootstrap Icons: https://github.com/twbs/icons/blob/main/LICENSE — MIT.
- Iconify source transforms/metadata: https://github.com/iconify/icon-sets.

**Selection rule.** Only original `icons` entries, no alias entries. Drop hidden icons, unsupported external/internal ID references and unsafe markup; restrict to monochrome paths, known safe icon-name syntax and the standard square viewBox. Dedupe normalized exact SVG bodies inside each family. Tabler excludes *-filled, Phosphor excludes -bold/-thin/-light/-fill/-duotone, Heroicons excludes solid/16-solid/20-solid, Bootstrap excludes *-fill. Different semantic descriptions of the same body must not be counted twice. Visual similarity among genuinely different SVG paths is not treated as bit-identical, and some related designs may still be similar. Each pack has one standard weight/style and counts refer to actual local data, not upstream marketing totals.

**Rendering/storage.** Each static SVG sprite is loaded on demand via same-origin `<svg><use href="/icon-packs/PACK.svg#i-NAME" /></svg>`. The corresponding JSON names are fetched only when a picker for that family opens. Legacy semantic icon keys stay supported; new selection keys use `PACK:icon/SLUG` (including explicitly namespaced Lucide). Do not change existing persistence without a migration strategy. Real user choices and finance semantics must remain intact.

**Validation expected.** Tests must verify JSON counts, canonical unique SVG bodies, safe names/markup, all five preview/render paths, locale-filtered search/paging, persisted selections, light/dark and mobile/desktop screenshots. Browser sprite loading plus offline Windows package must be verified before merging into develop.
