import { MINUTE, type BanStep } from './rules.ts';

/** Ban length for the n-th no-show. Offenses past the last step use the last step. */
export function banMinutesForOffense(offense: number, ladder: readonly BanStep[]): number {
  if (offense < 1) throw new Error('Offense numbers start at 1');
  if (ladder.length === 0) throw new Error('Ban ladder is empty');
  const sorted = [...ladder].sort((a, b) => a.offense - b.offense);
  let step = sorted[0]!;
  for (const s of sorted) if (s.offense <= offense) step = s;
  return step.minutes;
}

export interface BanLike {
  startsAt: Date | number;
  endsAt: Date | number | null; // null = permanent (admin ban)
  liftedAt?: Date | number | null;
}

/** The ban created by a new no-show, given how many (non-voided) no-shows the user had before. */
export function banForNewNoShow(previousNoShows: number, now: Date | number, ladder: readonly BanStep[]) {
  const offense = previousNoShows + 1;
  const start = typeof now === 'number' ? now : now.getTime();
  const minutes = banMinutesForOffense(offense, ladder);
  return { offense, minutes, startsAt: new Date(start), endsAt: new Date(start + minutes * MINUTE) };
}

const ms = (d: Date | number) => (typeof d === 'number' ? d : d.getTime());

/** The ban in force at `now` that ends last, or null. */
export function activeBan<T extends BanLike>(bans: readonly T[], now: Date | number): T | null {
  const t = ms(now);
  const active = bans.filter((b) => !b.liftedAt && ms(b.startsAt) <= t && (b.endsAt === null || ms(b.endsAt) > t));
  if (active.length === 0) return null;
  return active.reduce((a, b) => (a.endsAt === null ? a : b.endsAt === null ? b : ms(a.endsAt) >= ms(b.endsAt) ? a : b));
}
