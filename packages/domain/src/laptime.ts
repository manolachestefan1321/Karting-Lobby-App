/** Lap times are stored as integer milliseconds. */

/** Formats 61234 → "1:01.234", 45678 → "45.678". */
export function formatLapTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) throw new Error('Invalid lap time');
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.round(ms % 1000);
  const ss = String(seconds).padStart(minutes > 0 ? 2 : 1, '0');
  const mmm = String(millis).padStart(3, '0');
  return minutes > 0 ? `${minutes}:${ss}.${mmm}` : `${ss}.${mmm}`;
}

/**
 * Parses user input like "1:01.234", "61.234", "45.6" into milliseconds.
 * Returns null for anything that is not a plausible kart lap (5s – 10min).
 */
export function parseLapTime(input: string): number | null {
  const match = /^\s*(?:(\d{1,2}):)?(\d{1,3})(?:[.,](\d{1,3}))?\s*$/.exec(input);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  if (match[1] && seconds >= 60) return null;
  const fraction = match[3] ? Number(match[3].padEnd(3, '0')) : 0;
  const ms = minutes * 60000 + seconds * 1000 + fraction;
  if (ms < 5000 || ms > 600000) return null;
  return ms;
}
