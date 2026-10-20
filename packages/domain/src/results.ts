/**
 * Results confirmation:
 *  - the host submits the finishing order of the drivers who attended;
 *  - every other classified participant can confirm or dispute within the deadline;
 *  - any dispute → 'disputed' (admin review);
 *  - no dispute and (everyone confirmed OR deadline passed) → 'final'.
 */
export type ResultsStatus = 'pending' | 'disputed' | 'final';

export interface ResultEntry {
  userId: string;
  position: number;
  bestLapMs?: number | null;
}

export type OrderValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'missing_driver' | 'unknown_driver' | 'duplicate_driver' | 'bad_positions' };

/** Positions must be exactly 1..N, one per attended driver, nobody missing or extra. */
export function validateFinishingOrder(entries: readonly ResultEntry[], attendedUserIds: readonly string[]): OrderValidation {
  if (entries.length === 0) return { ok: false, reason: 'empty' };
  const ids = entries.map((e) => e.userId);
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'duplicate_driver' };
  if (ids.some((id) => !attendedUserIds.includes(id))) return { ok: false, reason: 'unknown_driver' };
  if (attendedUserIds.some((id) => !ids.includes(id))) return { ok: false, reason: 'missing_driver' };
  const positions = entries.map((e) => e.position).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) return { ok: false, reason: 'bad_positions' };
  return { ok: true };
}

export interface ResultResponse {
  userId: string;
  response: 'confirm' | 'dispute';
}

export function resultsStatus(input: {
  responses: readonly ResultResponse[];
  /** Participants who must respond (classified drivers except the host who submitted). */
  respondents: readonly string[];
  deadline: Date | number;
  now: Date | number;
  /** Set by an admin after reviewing a dispute. */
  adminDecision?: 'approved' | 'rejected' | null;
}): ResultsStatus | 'rejected' {
  if (input.adminDecision === 'approved') return 'final';
  if (input.adminDecision === 'rejected') return 'rejected';
  if (input.responses.some((r) => r.response === 'dispute')) return 'disputed';
  const confirmed = new Set(input.responses.filter((r) => r.response === 'confirm').map((r) => r.userId));
  const everyoneConfirmed = input.respondents.every((id) => confirmed.has(id));
  const t = typeof input.now === 'number' ? input.now : input.now.getTime();
  const d = typeof input.deadline === 'number' ? input.deadline : input.deadline.getTime();
  if (everyoneConfirmed || t >= d) return 'final';
  return 'pending';
}
