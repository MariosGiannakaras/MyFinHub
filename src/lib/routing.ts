import type { PageId } from '../components/AppShell';

export const PAGE_IDS: PageId[] = [
  'dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings',
];

export type HashRouteResolution = {
  page: PageId;
  notFound: boolean;
  redirectHash?: string;
};

export function resolveHashRoute(hash: string): HashRouteResolution {
  const raw = String(hash || '').replace(/^#\/?/, '').trim();
  if (!raw) return { page: 'dashboard', notFound: false };
  if (raw === 'review') return { page: 'attention', notFound: false, redirectHash: '#/attention' };
  if (PAGE_IDS.includes(raw as PageId)) return { page: raw as PageId, notFound: false };
  return { page: 'dashboard', notFound: true };
}

export function pageHash(page: PageId) {
  return `#/${page}`;
}
