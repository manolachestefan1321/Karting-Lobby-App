import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { api, type SiteEvent } from '@/data';
import { useConsent } from './consent';

/**
 * Anonymous website analytics for the owner's dashboard: a page view on every
 * route change and a heartbeat every minute while the tab is visible ("online now").
 * No names or emails: a random visitor id (this browser, renewed after 13 months)
 * and a session id (this tab). Runs ONLY after the visitor accepts statistics.
 */
const HEARTBEAT_MS = 60_000;
const VISITOR_MAX_AGE_MS = 395 * 24 * 3_600_000; // 13 months, as in the privacy policy

/** Random id saved as "id|createdAt"; a new one after `maxAgeMs`. */
function stored(storage: Storage | undefined, key: string, maxAgeMs = Infinity): string {
  try {
    const [id, created] = (storage?.getItem(key) ?? '').split('|');
    if (id && Date.now() - Number(created || 0) < maxAgeMs) return id;
    const fresh = crypto.randomUUID();
    storage?.setItem(key, `${fresh}|${Date.now()}`);
    return fresh;
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
    visitorId: stored(window.localStorage, 'kartup-vid', VISITOR_MAX_AGE_MS),
    sessionId: stored(window.sessionStorage, 'kartup-sid'),
    path,
    referrer,
    utmSource: new URLSearchParams(window.location.search).get('utm_source'),
    device: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
  };
}

export function SiteTracker() {
  const pathname = usePathname();
  const allowed = useConsent((s) => s.choice?.analytics === true);

  useEffect(() => {
    if (allowed) void api.analytics.track({ ...base(pathname), kind: 'pageview' }).catch(() => undefined);
  }, [pathname, allowed]);

  useEffect(() => {
    if (!allowed) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void api.analytics.track({ ...base(window.location.pathname), kind: 'heartbeat' }).catch(() => undefined);
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [allowed]);

  return null;
}
