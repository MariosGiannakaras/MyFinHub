export const money = new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' });

);

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('el-GR', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1));
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

export function cleanNote(note = '') {
  const marker = 'Comment:\n';
  if (note.includes(marker)) return note.split(marker).slice(1).join(marker).replace(/\nReply:\n/g, '\n').trim();
  return note.replace(/\[Threaded comment\][\s\S]*?Comment:\n/i, '').trim();
}

);

);

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('el-GR', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1));
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

export function cleanNote(note = '') {
  const marker = 'Comment:\n';
  if (note.includes(marker)) return note.split(marker).slice(1).join(marker).replace(/\nReply:\n/g, '\n').trim();
  return note.replace(/\[Threaded comment\][\s\S]*?Comment:\n/i, '').trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
