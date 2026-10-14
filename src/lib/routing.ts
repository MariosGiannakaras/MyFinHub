const PAGE_IDS = [
  'dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings',
] as const;

const SETTINGS_TAB_IDS=['general','profile','accounts','categories','icons','rules','data'] as const;

type AppRouteId = typeof PAGE_IDS[number];
export type SettingsTabId = typeof SETTINGS_TAB_IDS[number];

type HashRouteResolution = {
  page: AppRouteId;
  notFound: boolean;
  settingsTab?: SettingsTabId;
  redirectHash?: string;
};

export function resolveHashRoute(hash: string): HashRouteResolution {
  const raw = String(hash || '').replace(/^#\/?/, '').trim();
  if (!raw) return { page: 'dashboard', notFound: false };
  if (raw === 'review') return { page: 'attention', notFound: false, redirectHash: '#/attention' };
  const [pagePart,sectionPart,...rest]=raw.split('/');
  if(pagePart==='settings'&&sectionPart){
    if(rest.length||!SETTINGS_TAB_IDS.includes(sectionPart as SettingsTabId))return {page:'dashboard',notFound:true};
    return {page:'settings',notFound:false,settingsTab:sectionPart as SettingsTabId};
  }
  if (PAGE_IDS.includes(raw as AppRouteId)) return { page: raw as AppRouteId, notFound: false, settingsTab:raw==='settings'?'general':undefined };
  return { page: 'dashboard', notFound: true };
}

export function pageHash(page: AppRouteId) {
  return `#/${page}`;
}

export function settingsHash(tab:SettingsTabId){
  return tab==='general'?'#/settings':`#/settings/${tab}`;
}
