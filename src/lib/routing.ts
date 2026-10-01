const PAGE_IDS = [
  'dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings',
] as const;

type AppRouteId = typeof PAGE_IDS[number];

type HashRouteResolution = {
  page: AppRouteId;
  notFound: boolean;
  redirectHash?: string;
};

function normalizedHashPath(hash:string){
  const fragment=String(hash||'').replace(/^#/,'').trim();
  const withoutQuery=fragment.split('?',1)[0]??'';
  let decoded:string;
  try{decoded=decodeURIComponent(withoutQuery)}
  catch{return {path:'',malformed:true}}
  const path=decoded.replace(/^\/+|\/+$/g,'').replace(/\/{2,}/g,'/');
  return {path,malformed:false};
}

export function resolveHashRoute(hash: string): HashRouteResolution {
  const normalized=normalizedHashPath(hash);
  if(normalized.malformed)return {page:'dashboard',notFound:true};
  const raw=normalized.path;
  if (!raw) return { page: 'dashboard', notFound: false };
  if (raw === 'review') return { page: 'attention', notFound: false, redirectHash: '#/attention' };
  if (PAGE_IDS.includes(raw as AppRouteId)){
    const canonical=pageHash(raw as AppRouteId);
    return {page:raw as AppRouteId,notFound:false,...(String(hash||'')===canonical?{}:{redirectHash:canonical})};
  }
  return { page: 'dashboard', notFound: true };
}

export function pageHash(page: AppRouteId) {
  return `#/${page}`;
}
