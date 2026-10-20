import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { debug } from '@/data/mock/debug';
import { server } from '@/data/mock';
import { useTheme } from '@/theme/ThemeProvider';
import { FROM_APP, FROM_PANEL, isInsidePreviewFrame, type PanelCommand } from './protocol';

/**
 * Runs inside the phone frame. Executes the debug panel's commands against the fake
 * backend and reports a state snapshot back whenever something changes.
 */
export function DebugBridge() {
  const pathname = usePathname();
  const { scheme } = useTheme();
  const latest = useRef({ pathname, scheme });
  latest.current = { pathname, scheme };

  useEffect(() => {
    if (!isInsidePreviewFrame()) return;
    const post = (msg: unknown) => window.parent.postMessage(msg, window.location.origin);
    const sendSnapshot = () =>
      post({ source: FROM_APP, kind: 'snapshot', snapshot: debug.snapshot(), path: latest.current.pathname, theme: latest.current.scheme });

    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data as PanelCommand;
      if (!msg || msg.source !== FROM_PANEL) return;
      try {
        let value: unknown;
        if (msg.command === 'navigate') {
          router.push(msg.args[0] as never);
        } else if (msg.command === 'openEmailLink') {
          router.push(debug.emailLink(msg.args[0] as string) as never);
        } else if (msg.command === 'snapshot') {
          // just reply below
        } else {
          const fn = (debug as unknown as Record<string, (...a: unknown[]) => unknown>)[msg.command];
          if (!fn) throw new Error(`Unknown command ${msg.command}`);
          value = await fn(...msg.args);
        }
        post({ source: FROM_APP, kind: 'result', id: msg.id, ok: true, value });
      } catch (err) {
        post({ source: FROM_APP, kind: 'result', id: msg.id, ok: false, error: (err as Error).message });
      }
      sendSnapshot();
    };

    window.addEventListener('message', onMessage);
    const unsub = server.on('debug-bridge', sendSnapshot);
    const timer = setInterval(sendSnapshot, 5000);
    sendSnapshot();
    return () => {
      window.removeEventListener('message', onMessage);
      unsub();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isInsidePreviewFrame()) return;
    window.parent.postMessage({ source: FROM_APP, kind: 'snapshot', snapshot: debug.snapshot(), path: pathname, theme: scheme }, window.location.origin);
  }, [pathname, scheme]);

  return null;
}
