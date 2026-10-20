import { describe, expect, it } from 'vitest';
import { formatMoney, hostPayoutMinor, participantPrice, platformRevenueMinor } from '../src/money.ts';

describe('pricing', () => {
  it('adds the 5 RON platform fee to the track price per driver', () => {
    expect(participantPrice(8000, 500)).toEqual({ trackMinor: 8000, feeMinor: 500, totalMinor: 8500, currency: 'RON' });
  });

  it('rejects non-integer amounts (money is never a float)', () => {
    expect(() => participantPrice(80.5, 500)).toThrow();
    expect(() => participantPrice(8000, -1)).toThrow();
  });

  it("matches the owner's example: 800 RON track, 10 drivers", () => {
    const seats = Array(10).fill('attended');
    expect(hostPayoutMinor(8000, seats)).toBe(80000); // host gets 800 RON
    expect(platformRevenueMinor(500, seats)).toBe(5000); // platform keeps 50 RON
  });

  it('does not pay the host for refunded seats, but does for no-shows', () => {
    const seats = ['attended', 'attended', 'no_show', 'cancelled', 'removed', 'confirmed'];
    expect(hostPayoutMinor(8000, seats)).toBe(4 * 8000);
  });

  it('formats per locale', () => {
    expect(formatMoney(8500, 'RON', 'en')).toBe('85 RON');
    expect(formatMoney(8550, 'RON', 'ro')).toBe('85,50 RON');
    expect(formatMoney(123400, 'RON', 'ro')).toBe('1.234 RON');
  });
});
