/** Messages between the preview page (phone frame + debug panel) and the app in the frame. */
export const FROM_PANEL = 'kartup-preview-panel';
export const FROM_APP = 'kartup-preview-app';

export interface PanelCommand {
  source: typeof FROM_PANEL;
  id: number;
  command: string;
  args: unknown[];
}

export type AppMessage =
  | { source: typeof FROM_APP; kind: 'result'; id: number; ok: boolean; value?: unknown; error?: string }
  | { source: typeof FROM_APP; kind: 'snapshot'; snapshot: unknown; path: string; theme: 'dark' | 'light' };

/** True when this window is the outer preview page (not the app inside the frame). */
export function isPreviewHost(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
  if (window.location.search.includes('noframe')) return false;
  return window.top === window.self;
}

export function isInsidePreviewFrame(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined' && window.top !== window.self;
}
