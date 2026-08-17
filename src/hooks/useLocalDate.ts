import { useEffect, useState } from 'react';

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

export function useLocalDate() {
  const [today, setToday] = useState(() => localDateString());

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(refresh, millisecondsUntilNextLocalDay());
    };
    const refresh = () => {
      const next = localDateString();
      setToday((current) => current === next ? current : next);
      schedule();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return today;
}
