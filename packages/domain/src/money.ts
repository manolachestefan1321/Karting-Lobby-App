/** Money is always an integer number of minor units (bani). Never floats. */

export interface PriceBreakdown {
  trackMinor: number;
  feeMinor: number;
  totalMinor: number;
  currency: string;
}

/** What one participant pays: the track's per-driver price plus the platform fee. */
export function participantPrice(trackPricePerDriverMinor: number, platformFeeMinor: number, currency = 'RON'): PriceBreakdown {
  if (!Number.isInteger(trackPricePerDriverMinor) || trackPricePerDriverMinor < 0) throw new Error('Invalid track price');
  if (!Number.isInteger(platformFeeMinor) || platformFeeMinor < 0) throw new Error('Invalid fee');
  return {
    trackMinor: trackPricePerDriverMinor,
    feeMinor: platformFeeMinor,
    totalMinor: trackPricePerDriverMinor + platformFeeMinor,
    currency,
  };
}

/**
 * Seat states whose money is KEPT (not refunded). The host is paid the track price for
 * each of these: they paid the track for the slot whether or not the driver showed up.
 */
export const KEPT_SEAT_STATUSES = ['confirmed', 'attended', 'no_show'] as const;

export function hostPayoutMinor(trackPricePerDriverMinor: number, seatStatuses: readonly string[]): number {
  const kept = seatStatuses.filter((s) => (KEPT_SEAT_STATUSES as readonly string[]).includes(s)).length;
  return kept * trackPricePerDriverMinor;
}

export function platformRevenueMinor(platformFeeMinor: number, seatStatuses: readonly string[]): number {
  const kept = seatStatuses.filter((s) => (KEPT_SEAT_STATUSES as readonly string[]).includes(s)).length;
  return kept * platformFeeMinor;
}

/** "85 RON" / "85,50 RON" — uses the locale's decimal separator, hides ",00". */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const value = minor / 100;
  const hasCents = minor % 100 !== 0;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${number} ${currency}`;
}
