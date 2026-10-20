import { checkinWindow } from './timeline.ts';
import type { RulesConfig } from './rules.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type CheckinDecision =
  | { ok: true; distance: number }
  | { ok: false; reason: 'too_early' | 'too_late' | 'too_far' | 'not_paid'; distance?: number };

export function checkinDecision(input: {
  now: Date | number;
  startsAt: Date | number;
  position: LatLng;
  track: LatLng;
  paid: boolean;
  radiusMeters?: number | null;
  rules: RulesConfig;
}): CheckinDecision {
  if (!input.paid) return { ok: false, reason: 'not_paid' };
  const t = typeof input.now === 'number' ? input.now : input.now.getTime();
  const { opens, closes } = checkinWindow(input.startsAt, input.rules);
  if (t < opens.getTime()) return { ok: false, reason: 'too_early' };
  if (t >= closes.getTime()) return { ok: false, reason: 'too_late' };
  const distance = distanceMeters(input.position, input.track);
  const radius = input.radiusMeters ?? input.rules.checkinRadiusMeters;
  if (distance > radius) return { ok: false, reason: 'too_far', distance };
  return { ok: true, distance };
}

/** After check-in closes: a paid driver who neither checked in nor was confirmed by the host is a no-show. */
export function isNoShow(member: { paid: boolean; checkedIn: boolean; hostConfirmed: boolean }): boolean {
  return member.paid && !member.checkedIn && !member.hostConfirmed;
}
