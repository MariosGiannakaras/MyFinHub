import {existsSync,readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

type EvidenceOwner={id:string;runner:string;requirement?:string};
type Manifest={
 schema:string;purpose:string;status:string;routeIds:string[];settingsTabIds:string[];
 routeMatrix:{requiredViewports:{id:string;width:number;height:number}[];themes:string[];baselineRunner:string;status:string;baselineActuallyAutomated:string};
 namedSurfaces:EvidenceOwner[];requiredStates:EvidenceOwner[];
 acceptance:{finalGates:string[];rule:string;unresolved:string};
};
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('docs/audits/WHOLE_APP_RENDERED_STATE_COVERAGE_649.json')) as Manifest;
const canonicalIds=(source:string,key:string)=>{
 const match=source.match(new RegExp('const '+key+'\\s*=\\s*\\[([\\s\\S]*?)\\] as const;'));
 if(!match)throw new Error('Missing canonical route array '+key);
 return [...match[1].matchAll(/'([^']+)'/g)].map(row=>row[1]);
};

describe('#649 I23.02 explicit rendered state coverage inventory',()=>{
 it('tracks all 12 canonical routes and 7 real Settings hash tabs without duplicate or invented routes',()=>{
   const routing=read('src/lib/routing.ts');
   expect(manifest.schema).toBe('myfinhub-649-rendered-state-coverage-v1');
   expect(manifest.routeIds).toEqual(canonicalIds(routing,'PAGE_IDS'));
   expect(manifest.settingsTabIds).toEqual(canonicalIds(routing,'SETTINGS_TAB_IDS'));
   expect(manifest.routeIds).toHaveLength(12);
   expect(manifest.settingsTabIds).toHaveLength(7);
   expect(new Set(manifest.routeIds).size).toBe(12);
   expect(new Set(manifest.settingsTabIds).size).toBe(7);
 });
 it('defines 96 route × breakpoint × theme requirements without falsely declaring the draft head fully visually proven',()=>{
   expect(manifest.routeMatrix.requiredViewports.map(v=>v.width)).toEqual([320,375,768,1440]);
   expect(manifest.routeMatrix.themes).toEqual(['light','dark']);
   const cells=manifest.routeIds.flatMap(route=>manifest.routeMatrix.requiredViewports.flatMap(view=>
     manifest.routeMatrix.themes.map(theme=>route+'-'+view.id+'-'+theme)));
   expect(cells).toHaveLength(96);
   expect(new Set(cells).size).toBe(96);
   expect(manifest.status).toBe('pending-final-ready-qa');
   expect(manifest.routeMatrix.status).toBe('pending-final-ready-qa');
   const baseline=read(manifest.routeMatrix.baselineRunner);
   for(const route of manifest.routeIds)expect(baseline).toContain(route+':');
   expect(baseline).toContain("mode:'desktop',width:1440,height:1000");
   expect(baseline).toContain("mode:'mobile',width:375,height:812");
   expect(manifest.routeMatrix.baselineActuallyAutomated).toContain('other required cells remain');
 });
 it('owns auth, seven Settings tabs, overlays, negative and privacy states using real registered QA suites',()=>{
   const runner=read('scripts/run-rendered-qa.mjs');
   const entries=[...manifest.namedSurfaces,...manifest.requiredStates];
   const required=['populated','empty','loading','pending','error','conflict','offline','privacy-masked',
     'privacy-visible','keyboard-focus','reduced-motion','dark-theme','session-expired'];
   expect(manifest.requiredStates.map(s=>s.id)).toEqual(required);
   for(const id of ['login','mfa','settings-seven-tabs','dialogs','quick-entry','local-receipt','desktop-shell'])
     expect(manifest.namedSurfaces.map(s=>s.id)).toContain(id);
   expect(new Set(entries.filter(e=>e.id).map(e=>e.id)).size).toBe(entries.length);
   for(const owner of entries){
     expect(owner.runner).toMatch(/^scripts\/[a-z0-9-]+\.mjs$/);
     expect(existsSync(new URL('../'+owner.runner,import.meta.url))).toBe(true);
     expect(runner).toContain("path:'"+owner.runner+"'");
   }
 });
 it('requires actual current-head CI plus direct screenshot inspection, not a guessed PASS',()=>{
   const gates=manifest.acceptance.finalGates;
   for(const gate of ['CodeQL','Unified','Chromium','WebKit','Lighthouse','Windows host/installer','visual evidence inspection'])
     expect(gates).toContain(gate);
   expect(manifest.acceptance.rule).toContain('direct screenshot/log artifact inspection');
   expect(manifest.acceptance.unresolved).toContain('missing final');
   expect(manifest.purpose).toContain('not evidence of executed');
   expect(JSON.stringify(manifest)).not.toMatch(/"pass(?:ed)?"\s*:\s*true/i);
 });
});
