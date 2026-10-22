/**
 * The local web preview page: the app runs inside a phone frame (iframe, so modals,
 * scrolling and screen size behave like on a phone) with a debug panel next to it.
 * Only used with the mock backend on the web — never part of the iOS/Android app.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { brand } from '@config/brand';
import type { DebugSnapshot } from '@/data/mock/debug';
import { FROM_APP, FROM_PANEL, type AppMessage } from './protocol';

type Device = 'iphone' | 'android';
const DEVICES: Record<Device, { w: number; h: number; radius: number; bezel: number; statusBar: number; bottomBar: number; label: string }> = {
  iphone: { w: 393, h: 852, radius: 56, bezel: 12, statusBar: 54, bottomBar: 34, label: 'iPhone · 393×852' },
  android: { w: 412, h: 915, radius: 34, bezel: 10, statusBar: 32, bottomBar: 24, label: 'Android · 412×915' },
};

const C = {
  bg: '#0E0E11',
  panel: '#17171C',
  panelAlt: '#202027',
  border: '#2C2C34',
  text: '#F5F5F7',
  muted: '#A3A3AD',
  faint: '#71717C',
  accent: brand.colors.accent,
  ok: '#22A750',
  warn: '#E5A000',
};

const fmtTime = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', ...opts }).format(new Date(iso));

export function PreviewHost() {
  const [device, setDevice] = useState<Device>(() => (localStorage.getItem('kartup-preview-device') as Device) || 'iphone');
  const [snap, setSnap] = useState<DebugSnapshot | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [path, setPath] = useState('/');
  const [log, setLog] = useState<{ text: string; ok: boolean; at: number }[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [email, setEmail] = useState<{ id: string; html: string; subject: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [frameKey, setFrameKey] = useState(0);
  const [tick, setTick] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const pending = useRef(new Map<number, (m: Extract<AppMessage, { kind: 'result' }>) => void>());
  const seq = useRef(1);
  const snapAt = useRef(Date.now());
  const d = DEVICES[device];

  useEffect(() => {
    document.title = `${brand.name} — ${brand.slogan} · Preview`;
    document.body.style.margin = '0';
    document.body.style.background = C.bg;
  }, []);
  useEffect(() => localStorage.setItem('kartup-preview-device', device), [device]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data as AppMessage;
      if (!msg || msg.source !== FROM_APP) return;
      if (msg.kind === 'snapshot') {
        setSnap(msg.snapshot as DebugSnapshot);
        snapAt.current = Date.now();
        setPath(msg.path);
        setTheme(msg.theme);
      } else {
        pending.current.get(msg.id)?.(msg);
        pending.current.delete(msg.id);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Fit the phone in the window.
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 90) / (d.h + d.bezel * 2)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [d.h, d.bezel]);

  // Keep the status-bar clock ticking between snapshots.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const run = useCallback((command: string, ...args: unknown[]): Promise<unknown> => {
    const id = seq.current++;
    return new Promise((resolve) => {
      pending.current.set(id, (m) => {
        const text = m.ok ? (typeof m.value === 'string' ? m.value : `${command} ✓`) : `${command}: ${m.error}`;
        if (m.ok && command !== 'emailHtml') setLog((l) => [{ text, ok: true, at: Date.now() }, ...l].slice(0, 8));
        if (!m.ok) setLog((l) => [{ text, ok: false, at: Date.now() }, ...l].slice(0, 8));
        resolve(m.value);
      });
      iframe.current?.contentWindow?.postMessage({ source: FROM_PANEL, id, command, args }, window.location.origin);
    });
  }, []);

  const now = snap ? new Date(new Date(snap.now).getTime() + (Date.now() - snapAt.current)) : new Date();
  void tick;
  const selected = snap?.sessions.find((s) => s.id === sessionId) ?? null;
  useEffect(() => {
    if (snap && (!sessionId || !snap.sessions.some((s) => s.id === sessionId))) {
      const first = snap.sessions.find((s) => s.myStatus || s.isHost) ?? snap.sessions[0];
      if (first) setSessionId(first.id);
    }
  }, [snap, sessionId]);

  const statusBg = theme === 'dark' ? '#0B0B0D' : '#F5F5F7';
  const statusFg = theme === 'dark' ? '#FFFFFF' : '#0B0B0D';
  const offsetMin = Math.round((snap?.offsetMs ?? 0) / 60000);
  const offsetLabel = offsetMin === 0 ? 'real time' : `${offsetMin > 0 ? '+' : '−'}${fmtDuration(Math.abs(offsetMin))} from real time`;

  return (
    <div style={{ display: 'flex', gap: 28, padding: 20, minHeight: '100vh', boxSizing: 'border-box', fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif', color: C.text, background: `radial-gradient(1200px 600px at 20% 0%, #1b1b22, ${C.bg})` }}>
      {/* ── Phone ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(Object.keys(DEVICES) as Device[]).map((k) => (
            <button key={k} onClick={() => setDevice(k)} style={btn(device === k)}>
              {DEVICES[k].label}
            </button>
          ))}
          <button onClick={() => setFrameKey((x) => x + 1)} style={btn(false)} title="Reload the app (shows the splash again)">
            ↻ Replay splash
          </button>
        </div>
        <div style={{ width: (d.w + d.bezel * 2) * scale, height: (d.h + d.bezel * 2) * scale }}>
          <div
            style={{
              width: d.w + d.bezel * 2,
              height: d.h + d.bezel * 2,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              background: '#050506',
              borderRadius: d.radius + d.bezel,
              padding: d.bezel,
              boxSizing: 'border-box',
              boxShadow: '0 30px 80px rgba(0,0,0,.6), inset 0 0 0 2px #2a2a30',
            }}
          >
            <div style={{ width: d.w, height: d.h, borderRadius: d.radius, overflow: 'hidden', background: statusBg, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <StatusBar device={device} height={d.statusBar} fg={statusFg} time={fmtTime(now.toISOString(), { hour: '2-digit', minute: '2-digit' })} />
              <iframe
                key={frameKey}
                ref={iframe}
                title={`${brand.name} app`}
                src="/?frame=1"
                style={{ border: 0, width: d.w, flex: 1, display: 'block', background: statusBg }}
              />
              <div style={{ height: d.bottomBar, display: 'flex', alignItems: 'center', justifyContent: 'center', background: statusBg }}>
                <div style={{ width: device === 'iphone' ? 134 : 108, height: device === 'iphone' ? 5 : 4, borderRadius: 3, background: statusFg, opacity: 0.85 }} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.faint }}>
          {path} · live reload on · demo data stored in this browser
        </div>
      </div>

      {/* ── Debug panel ─────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 340, maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', letterSpacing: 0.3 }}>
            {brand.wordmark.lead}
            <span style={{ color: C.accent }}>{brand.wordmark.accent}</span>
          </span>
          <span style={{ color: C.muted, fontSize: 13 }}>{brand.slogan}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.warn, border: `1px solid ${C.warn}`, borderRadius: 6, padding: '2px 6px' }}>PREVIEW · FAKE DATA</span>
        </div>

        <Section title="🕒 Time">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(now.toISOString(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span style={{ color: offsetMin ? C.warn : C.muted, fontSize: 12 }}>Bucharest · {offsetLabel}</span>
          </div>
          <Row>
            <button style={btn()} onClick={() => run('advance', -60)}>−1 h</button>
            <button style={btn()} onClick={() => run('advance', 15)}>+15 min</button>
            <button style={btn()} onClick={() => run('advance', 60)}>+1 h</button>
            <button style={btn()} onClick={() => run('advance', 6 * 60)}>+6 h</button>
            <button style={btn()} onClick={() => run('advance', 24 * 60)}>+1 day</button>
            <button style={btn()} onClick={() => run('resetClock')}>Back to real time</button>
          </Row>
        </Section>

        <Section title="👤 Signed in as">
          <Row>
            <select
              value={snap?.currentUserId ?? ''}
              onChange={(e) => (e.target.value ? run('switchUser', e.target.value) : run('signOut'))}
              style={select}
            >
              <option value="">— signed out —</option>
              {snap?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.email}
                  {u.banned ? ' · BANNED' : ''}
                </option>
              ))}
            </select>
          </Row>
          <Row>
            <span style={{ color: C.muted, fontSize: 13 }}>Simulated GPS:</span>
            <button style={btn(snap?.atTrack)} onClick={() => run('setAtTrack', true)}>📍 At the track</button>
            <button style={btn(!!snap && !snap.atTrack)} onClick={() => run('setAtTrack', false)}>🏠 5 km away</button>
          </Row>
          <div style={{ fontSize: 12, color: C.faint }}>Test login: andrei@kartup.test · password {snap?.testPassword ?? 'kartup123'} (every demo user has the same password)</div>
        </Section>

        <Section title="🏁 Session">
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={select}>
            {snap?.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · {fmtTime(s.startsAt, { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {s.phase} · {s.paid}/{s.max}
                {s.isHost ? ' · YOU HOST' : s.myStatus ? ` · you: ${s.myStatus}` : ''}
              </option>
            ))}
          </select>
          {selected ? (
            <>
              <Row>
                <button style={btn(false, true)} onClick={() => run('navigate', `/session/${selected.id}`)}>Open lobby in the app →</button>
              </Row>
              <Label>Jump the clock to…</Label>
              <Row>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, -181)} title="Auto-cancel check (fewer than 4 paid)">3 h before</button>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, -120)} title="Reminder notification">2 h before</button>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, -61)} title="Last minute with free cancellation">61 min before</button>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, -59)} title="Cancellation closed">59 min before</button>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, -10)} title="Check-in open">10 min before</button>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, 16)} title="Check-in closed → no-shows & bans">16 min after</button>
                <button style={btn()} onClick={() => run('jumpToSession', selected.id, 25 * 60 + 30)} title="After the 24 h confirmation window">+25 h after</button>
              </Row>
              <Label>Other drivers…</Label>
              <Row>
                <button style={btn()} onClick={() => run('someoneJoins', selected.id)}>Someone joins & pays</button>
                <button style={btn()} onClick={() => run('someoneEntersUnpaid', selected.id)}>Someone enters (unpaid)</button>
                <button style={btn()} onClick={() => run('fillLobby', selected.id)}>Fill the lobby</button>
                <button style={btn()} onClick={() => run('someoneLeaves', selected.id)}>Someone cancels</button>
                <button style={btn()} onClick={() => run('someoneChats', selected.id)}>Someone chats</button>
                <button style={btn()} onClick={() => run('othersCheckIn', selected.id)}>Others check in</button>
              </Row>
              <Label>Results & admin…</Label>
              <Row>
                <button style={btn()} onClick={() => run('othersRespond', selected.id, 'confirm')}>Others confirm results</button>
                <button style={btn()} onClick={() => run('othersRespond', selected.id, 'dispute')}>Someone disputes</button>
                <button style={btn()} onClick={() => run('adminDecide', selected.id, true)}>Admin: approve results</button>
                <button style={btn()} onClick={() => run('adminDecide', selected.id, false)}>Admin: reject results</button>
                <button style={btn()} onClick={() => run('adminDecide', selected.id, true, true)}>Admin: approve, dispute was false (−XP)</button>
                <button style={btn()} onClick={() => run('trackCancels', selected.id)}>Track cancels session</button>
              </Row>
            </>
          ) : null}
        </Section>

        {snap?.appeals.length ? (
          <Section title="⚖️ Ban appeals (admin)">
            {snap.appeals.map((a) => (
              <Row key={a.banId}>
                <span style={{ flex: 1, fontSize: 13 }}>
                  <b>{a.userName}</b>: “{a.message}” · <i>{a.status}</i>
                </span>
                {a.status === 'pending' ? (
                  <>
                    <button style={btn()} onClick={() => run('resolveAppeal', a.banId, true)}>Approve</button>
                    <button style={btn()} onClick={() => run('resolveAppeal', a.banId, false)}>Reject</button>
                  </>
                ) : null}
              </Row>
            ))}
          </Section>
        ) : null}

        <Section title={`✉️ Email inbox (${snap?.emails.length ?? 0})`}>
          {!snap?.emails.length ? (
            <div style={{ color: C.faint, fontSize: 13 }}>Sign-up confirmations and password-reset emails appear here.</div>
          ) : (
            snap.emails.map((e) => (
              <Row key={e.id}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: e.opened ? 400 : 700 }}>
                  {e.subject}
                  <span style={{ color: C.faint }}> · to {e.to}</span>
                </span>
                <button style={btn()} onClick={async () => setEmail({ id: e.id, subject: e.subject, html: (await run('emailHtml', e.id)) as string })}>Open</button>
              </Row>
            ))
          )}
        </Section>

        <Section title="🧰 Data">
          <Row>
            <button style={btn()} onClick={() => confirm('Reset all demo data? (sessions, payments, your changes)') && run('reset')}>Reset demo data</button>
            <a href="/?noframe=1" target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}>Open app without frame ↗</a>
          </Row>
        </Section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.map((l) => (
            <div key={l.at + l.text} style={{ fontSize: 12, color: l.ok ? C.ok : '#FF6B63' }}>
              {l.ok ? '✓' : '✗'} {l.text}
            </div>
          ))}
        </div>
      </div>

      {email ? (
        <div onClick={() => setEmail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 10 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: '100%', maxHeight: '90vh', background: C.panel, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <div style={{ padding: 14, display: 'flex', gap: 8, alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
              <b style={{ flex: 1, fontSize: 14 }}>{email.subject}</b>
              <button
                style={btn(false, true)}
                onClick={() => {
                  void run('openEmailLink', email.id);
                  setEmail(null);
                }}
              >
                Click the link in the app →
              </button>
              <button style={btn()} onClick={() => setEmail(null)}>Close</button>
            </div>
            <iframe title="email" srcDoc={email.html} sandbox="" style={{ border: 0, width: '100%', height: 620 }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBar({ device, height, fg, time }: { device: Device; height: number; fg: string; time: string }) {
  return (
    <div style={{ height, flexShrink: 0, display: 'flex', alignItems: 'center', padding: device === 'iphone' ? '0 34px' : '0 18px', position: 'relative', color: fg, fontSize: device === 'iphone' ? 16 : 13, fontWeight: 600 }}>
      <span>{time}</span>
      {device === 'iphone' ? (
        <div style={{ position: 'absolute', left: '50%', top: 11, transform: 'translateX(-50%)', width: 124, height: 36, borderRadius: 20, background: '#000' }} />
      ) : (
        <div style={{ position: 'absolute', left: '50%', top: 9, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: 7, background: '#000' }} />
      )}
      <span style={{ marginLeft: 'auto', letterSpacing: 1, fontSize: 12 }}>▂▄▆ ᯤ ▮▮▮▯</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{children}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{children}</div>;
}

function btn(selected = false, primary = false): CSSProperties {
  return {
    background: primary ? C.accent : selected ? C.accent : C.panelAlt,
    color: '#fff',
    border: `1px solid ${primary || selected ? C.accent : C.border}`,
    borderRadius: 8,
    padding: '7px 11px',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 600,
  };
}

const select: CSSProperties = {
  flex: 1,
  width: '100%',
  background: C.panelAlt,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
};

function fmtDuration(min: number) {
  const dd = Math.floor(min / 1440);
  const hh = Math.floor((min % 1440) / 60);
  const mm = min % 60;
  return [dd ? `${dd} d` : '', hh ? `${hh} h` : '', mm || (!dd && !hh) ? `${mm} min` : ''].filter(Boolean).join(' ');
}
