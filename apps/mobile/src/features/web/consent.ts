import { create } from 'zustand';
import { api } from '@/data';

/**
 * Cookie consent for the website (GDPR + ePrivacy Art. 5(3), Romanian Law 506/2004).
 *  - Nothing optional is stored before a choice: statistics stay OFF until accepted.
 *  - Accept and refuse are equally easy; changing your mind later is too ("Cookie settings").
 *  - The choice expires after 6 months, or when CONSENT_VERSION changes; then we ask again.
 *  - Each choice is recorded (random id, no personal data) so consent can be proven (Art. 7(1)).
 * The only optional category today is anonymous statistics; there is no advertising.
 */
export const CONSENT_VERSION = '2026-11-06';
const KEY = 'kartup-consent';
const MAX_AGE_MS = 182 * 24 * 3_600_000;

export interface ConsentChoice {
  version: string;
  analytics: boolean;
  decidedAt: string;
  id: string;
}

function read(): ConsentChoice | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ConsentChoice | null;
    if (!c || c.version !== CONSENT_VERSION || Date.now() - new Date(c.decidedAt).getTime() > MAX_AGE_MS) return null;
    return c;
  } catch {
    return null;
  }
}

/** Statistics IDs: removed as soon as consent is refused or withdrawn. */
export function clearAnalyticsStorage() {
  try {
    localStorage.removeItem('kartup-vid');
    sessionStorage.removeItem('kartup-sid');
  } catch {
    // storage blocked: nothing stored either
  }
}

interface ConsentState {
  choice: ConsentChoice | null;
  /** The detailed settings panel is open. */
  settingsOpen: boolean;
  decide: (analytics: boolean, locale: 'en' | 'ro') => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useConsent = create<ConsentState>((set, get) => ({
  choice: typeof localStorage === 'undefined' ? null : read(),
  settingsOpen: false,
  decide: (analytics, locale) => {
    const choice: ConsentChoice = { version: CONSENT_VERSION, analytics, decidedAt: new Date().toISOString(), id: get().choice?.id ?? crypto.randomUUID() };
    try {
      localStorage.setItem(KEY, JSON.stringify(choice));
    } catch {
      // storage blocked: the choice holds for this visit
    }
    if (!analytics) clearAnalyticsStorage();
    set({ choice, settingsOpen: false });
    void api.analytics.consent({ consentId: choice.id, analytics, version: CONSENT_VERSION, locale }).catch(() => undefined);
  },
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));

/** Open "Cookie settings" from anywhere (footer, Settings). */
export const openCookieSettings = () => useConsent.getState().openSettings();
