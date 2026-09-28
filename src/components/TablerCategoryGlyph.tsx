import type { SVGProps } from 'react';

/*
 * Curated local subset of Tabler Icons used by the MyFinHub category icon pack.
 * Source: https://github.com/tabler/tabler-icons
 * MIT License — Copyright (c) 2020-2026 Paweł Kuna.
 * Keeping the SVG paths local preserves offline rendering and avoids a runtime CDN dependency.
 */

type TablerGlyphName='coffee'|'shopping'|'gift'|'car'|'home'|'bolt'|'heart'|'book'|'plane'|'bank'|'wallet'|'receipt'|'exchange'|'other';

const GLYPH_BY_CATEGORY:Record<string,TablerGlyphName>={
  coffee:'coffee',dining:'coffee',groceries:'shopping',bakery:'shopping',takeaway:'shopping',clothing:'shopping',shoes:'shopping',shopping:'shopping',gift:'gift',electronics:'shopping',computer:'shopping',phone:'shopping',gaming:'gift',
  fuel:'car',parking:'car',car:'car',motorcycle:'car','public-transport':'car',taxi:'car',service:'car',insurance:'home',
  home:'home',rent:'home',furniture:'home',maintenance:'home',electricity:'bolt',water:'home',heating:'bolt',internet:'home',telephone:'home',
  subscription:'gift',streaming:'gift',music:'gift',cinema:'gift',entertainment:'gift',sport:'heart',gym:'heart',health:'heart',doctor:'heart',dentist:'heart',pharmacy:'heart',hospital:'heart',
  education:'book',books:'book',course:'book',travel:'plane',flight:'plane',hotel:'home',ferry:'plane',holiday:'plane',pet:'heart',child:'gift',family:'home','personal-care':'heart',barber:'heart',cosmetics:'heart',tobacco:'receipt',kiosk:'shopping',
  tax:'bank',government:'bank','bank-fee':'bank',cash:'wallet',card:'wallet',loan:'bank',installment:'bank',saving:'bank',investment:'bank',salary:'wallet',bonus:'gift',income:'wallet',refund:'exchange',sale:'shopping',freelance:'wallet',business:'wallet',charity:'gift',celebration:'gift',calendar:'receipt',receipt:'receipt',wallet:'wallet',transfer:'exchange',reconciliation:'exchange',other:'other',
};

function Base({size=18,children,...props}:SVGProps<SVGSVGElement>&{size?:number}){
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

function TablerGlyph({name,size}:{name:TablerGlyphName;size:number}){
  if(name==='coffee')return <Base size={size}><path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1"/><path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/><path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/><path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5"/><path d="M16.746 16.726a3 3 0 1 0 .252 -5.555"/></Base>;
  if(name==='shopping')return <Base size={size}><path d="M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 17h-11v-14h-2"/><path d="M6 5l14 1l-1 7h-13"/></Base>;
  if(name==='gift')return <Base size={size}><path d="M3 9a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -2"/><path d="M12 8l0 13"/><path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5"/></Base>;
  if(name==='car')return <Base size={size}><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/></Base>;
  if(name==='home')return <Base size={size}><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/></Base>;
  if(name==='bolt')return <Base size={size}><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></Base>;
  if(name==='heart')return <Base size={size}><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/></Base>;
  if(name==='book')return <Base size={size}><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/></Base>;
  if(name==='plane')return <Base size={size}><path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3l4 7"/></Base>;
  if(name==='bank')return <Base size={size}><path d="M3 21l18 0"/><path d="M3 10l18 0"/><path d="M5 6l7 -3l7 3"/><path d="M4 10l0 11"/><path d="M20 10l0 11"/><path d="M8 14l0 3"/><path d="M12 14l0 3"/><path d="M16 14l0 3"/></Base>;
  if(name==='wallet')return <Base size={size}><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12"/><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4"/></Base>;
  if(name==='receipt')return <Base size={size}><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2"/></Base>;
  if(name==='exchange')return <Base size={size}><path d="M7 10h14l-4 -4"/><path d="M17 14h-14l4 4"/></Base>;
  return <Base size={size}><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/></Base>;
}

export function TablerCategoryGlyph({iconKey,size=18}:{iconKey:string;size?:number}){
  return <TablerGlyph name={GLYPH_BY_CATEGORY[iconKey]??'other'} size={size}/>;
}
