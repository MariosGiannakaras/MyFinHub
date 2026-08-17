const pad = (value: number) => String(value).padStart(2, '0');

export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function millisecondsUntilNextLocalDay(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 25);
  return Math.max(25, next.getTime() - now.getTime());
}

export function reportingMonthForDate(currentMonth: string, today: string, manuallySelected: boolean) {
  return manuallySelected ? currentMonth : today.slice(0, 7);
}
