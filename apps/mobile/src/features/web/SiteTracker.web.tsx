import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { api, type SiteEvent } from '@/data';

/**
 * Anonymous website analytics for the owner's dashboard: a page view on every
 * route change and a heartbeat every minute while the tab is visible ("online now").
 * No names or emails: a random visitor id (this browser) and a session id (this tab).
 */
const HEARTBEAT_MS = 60_000;

function stored(storage: Storage | undefined, key: string): string {
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    storage?.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function base(path: string): Omit<SiteEvent, 'kind'> {
  const w = window.innerWidth;
  let referrer: string | null = null;
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    if (host && host !== window.location.hostname) referrer = host.replace(/^www\./, '');
  } catch {
    referrer = null;
  }
  return {
    visitorId: stored(window.localStorage, 'kartup-vid'),
    sessionId: stored(window.sessionStorage, 'kartup-sid'),
    path,
    referrer,
    utmSource: new URLSearchParams(window.location.search).get('utm_source'),
    device: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
  };
}

export function SiteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void api.analytics.track({ ...base(pathname), kind: 'pageview' }).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void api.analytics.track({ ...base(window.location.pathname), kind: 'heartbeat' }).catch(() => undefined);
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}
