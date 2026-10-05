const PAGE_IDS = [
  'dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings',
] as const;

type AppRouteId = typeof PAGE_IDS[number];

type HashRouteResolution = {
  page: AppRouteId;
  notFound: boolean;
  redirectHash?: string;
};

export function resolveHashRoute(hash: string): HashRouteResolution {
  const raw = String(hash || '').replace(/^#\/?/, '').trim();
  if (!raw) return { page: 'dashboard', notFound: false };
  if (raw === 'review') return { page: 'attention', notFound: false, redirectHash: '#/attention' };
  if (PAGE_IDS.includes(raw as AppRouteId)) return { page: raw as AppRouteId, notFound: false };
  return { page: 'dashboard', notFound: true };
}

export function pageHash(page: AppRouteId) {
  return `#/${page}`;
}
