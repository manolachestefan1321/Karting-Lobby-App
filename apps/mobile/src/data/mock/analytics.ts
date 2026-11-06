import { ANALYTICS_RANGES, type AnalyticsCount, type AnalyticsRange } from '../types';

/**
 * Demo website traffic for the owner's analytics dashboard. The demo has no real
 * visitors, so traffic is simulated: deterministic (same numbers on every reload),
 * busier in the evening and at weekends, growing towards launch.
 * Waitlist, accounts, payments and karting sessions come from the demo data instead.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Deterministic noise in [0.75, 1.25) for an integer key. */
function noise(key: number): number {
  let t = (key + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return 0.75 + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 0.5;
}

/** Visitors per hour at time `t` (ms). */
function rate(t: number, now: number, wholeDay: boolean): number {
  const daysAgo = Math.max(0, (now - t) / DAY);
  const trend = 6 + 34 * Math.exp(-daysAgo / 120); // ~6/h a year ago → ~40/h now
  const d = new Date(t);
  const hour = d.getHours() + d.getMinutes() / 60;
  // Quiet at night, peak around 20:00.
  const daily = wholeDay ? 1 : 0.15 + 1.45 * Math.exp(-((hour - 20) ** 2) / 18) + 0.5 * Math.exp(-((hour - 13) ** 2) / 10);
  const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.25 : 1;
  return trend * daily * weekend;
}

function period(from: number, seconds: number, buckets: number, now: number) {
  const step = (seconds * 1000) / buckets;
  const series = Array.from({ length: buckets }, (_, i) => {
    const start = from + i * step;
    const visits = rate(start + step / 2, now, step >= DAY) * (step / HOUR) * noise(Math.floor(start / step) + buckets * 7919);
    const visitors = Math.round(visits);
    return { visitors, pageviews: Math.round(visits * 2.4 * noise(Math.floor(start / step) + 31)) };
  });
  const hits = series.reduce((a, b) => a + b.visitors, 0);
  // Longer ranges: more returning visitors, so fewer unique ones per visit.
  const unique = Math.round(hits * Math.max(0.4, 0.95 - 0.09 * Math.log10(Math.max(1, seconds / 3600))));
  return { series, visitors: unique, sessions: Math.round(hits * 1.08), pageviews: series.reduce((a, b) => a + b.pageviews, 0) };
}

function split(total: number, shares: [string, number][]): AnalyticsCount[] {
  return shares.map(([label, share]) => ({ label, count: Math.round(total * share) })).filter((c) => c.count > 0);
}

export function simulatedTraffic(range: AnalyticsRange, now: number) {
  const { seconds, buckets } = ANALYTICS_RANGES[range];
  const from = now - seconds * 1000;
  const cur = period(from, seconds, buckets, now);
  const prev = period(from - seconds * 1000, seconds, buckets, now);
  return {
    from: new Date(from).toISOString(),
    ...cur,
    visitorsPrev: prev.visitors,
    sessionsPrev: prev.sessions,
    pageviewsPrev: prev.pageviews,
    onlineNow: Math.max(1, Math.round((rate(now, now, false) * 5) / 60 * noise(Math.floor(now / 60_000)) * 1.4)),
    avgSessionSecs: Math.round(150 * noise(Math.floor(from / DAY))),
    bounceRate: Math.round(42 * noise(Math.floor(from / HOUR) + 3)),
    /** Waitlist sign-ups the simulated visitors would bring (≈ 5% conversion). */
    waitlist: Math.round(cur.visitors * 0.05),
    waitlistPrev: Math.round(prev.visitors * 0.05),
    topPages: split(cur.pageviews, [
      ['/join', 0.46],
      ['/welcome', 0.21],
      ['/sessions', 0.13],
      ['/leaderboard', 0.09],
      ['/profile', 0.06],
      ['/legal/privacy', 0.05],
    ]),
    sources: split(cur.sessions, [
      ['instagram', 0.34],
      ['direct', 0.24],
      ['tiktok', 0.19],
      ['google', 0.11],
      ['facebook', 0.08],
      ['whatsapp', 0.04],
    ]),
    devices: split(cur.visitors, [
      ['mobile', 0.71],
      ['desktop', 0.24],
      ['tablet', 0.05],
    ]),
  };
}
