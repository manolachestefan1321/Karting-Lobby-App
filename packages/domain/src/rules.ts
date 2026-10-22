/**
 * All tunable business rules in ONE place. In production these values are read
 * from the database (app_config, ban_ladder) so an admin can change
 * them; these are the defaults and the values used by the web preview.
 */
export interface BanStep {
  /** 1 = first no-show, 2 = second… The last step applies to every later offense. */
  offense: number;
  minutes: number;
}

export interface RulesConfig {
  currency: string;
  /** Platform fee per driver, minor units (500 = 5.00 RON). */
  platformFeeMinor: number;
  /** Cancellation with full refund allowed until this many minutes before start. */
  cancelRefundCutoffMinutes: number;
  /** "Last chance to cancel" reminder this many minutes before start. */
  reminderBeforeMinutes: number;
  checkinOpensBeforeMinutes: number;
  checkinClosesAfterMinutes: number;
  /** Default check-in radius around the track (a track can override it). */
  checkinRadiusMeters: number;
  /** Sessions with fewer paid drivers than this at the auto-cancel time are cancelled and refunded. */
  minDrivers: number;
  autoCancelBeforeMinutes: number;
  /** Participants have this long to confirm or dispute results; then they become final. */
  resultsConfirmHours: number;
  banLadder: BanStep[];
}

export const DEFAULT_RULES: RulesConfig = {
  currency: 'RON',
  platformFeeMinor: 500,
  cancelRefundCutoffMinutes: 60,
  reminderBeforeMinutes: 120,
  checkinOpensBeforeMinutes: 30,
  checkinClosesAfterMinutes: 15,
  checkinRadiusMeters: 300,
  minDrivers: 4,
  autoCancelBeforeMinutes: 180,
  resultsConfirmHours: 24,
  banLadder: [
    { offense: 1, minutes: 60 },
    { offense: 2, minutes: 24 * 60 },
    { offense: 3, minutes: 7 * 24 * 60 },
    { offense: 4, minutes: 30 * 24 * 60 },
  ],
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
