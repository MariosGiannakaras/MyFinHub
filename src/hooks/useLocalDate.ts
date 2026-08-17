import { useEffect, useState } from 'react';
import { localDateString, millisecondsUntilNextLocalDay } from '../lib/localDate';

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
