// KartUP load test: N people using the app at the same time, against YOUR Supabase project.
//
// Each virtual user behaves like an open app: one live (Realtime) connection with the same
// channels as the app, the session list every 15–30 s, the leaderboard every ~60 s, the track
// list now and then. Optionally one lobby chats (a message every 10 s) so the live updates
// are exercised too. Nothing is created or deleted, except those chat messages if you turn them on.
//
// Run (on your Mac, from the repo folder):
//   LOADTEST_EMAIL=test@... LOADTEST_PASSWORD=... USERS=200 DURATION=180 node scripts/load-test.mjs
// Supabase URL and anon key are read from apps/mobile/.env (or SUPABASE_URL / SUPABASE_ANON_KEY).
// Optional: LOADTEST_SESSION=<id of a session the test account has a seat in> → chat traffic.
//
// Read the result: errors should stay 0, p95 under ~800 ms. On the Free plan more than
// 200 simultaneous live connections are refused (that is the plan limit, not a bug).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  (() => {
    try {
      return readFileSync(new URL('../apps/mobile/.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]);
    } catch {
      return [];
    }
  })(),
);
const URL_ = process.env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const USERS = Number(process.env.USERS || 100);
const DURATION = Number(process.env.DURATION || 120) * 1000;
const RAMP_PER_SEC = Number(process.env.RAMP || 10); // people joining per second
const CHAT_SESSION = process.env.LOADTEST_SESSION || null;
if (!URL_ || !KEY || !process.env.LOADTEST_EMAIL || !process.env.LOADTEST_PASSWORD) {
  console.error('Set LOADTEST_EMAIL and LOADTEST_PASSWORD (a test account), and the Supabase URL/key in apps/mobile/.env.');
  process.exit(1);
}

// One sign-in (Auth limits sign-ins per IP); every virtual user reuses the token.
const login = createClient(URL_, KEY, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await login.auth.signInWithPassword({ email: process.env.LOADTEST_EMAIL, password: process.env.LOADTEST_PASSWORD });
if (authErr) {
  console.error('Sign-in failed:', authErr.message);
  process.exit(1);
}
const token = auth.session.access_token;
const userId = auth.user.id;
const { data: profile } = await login.from('profiles').select('home_city_id').eq('id', userId).single();
const cityId = profile?.home_city_id;

const stats = { requests: 0, errors: 0, times: [], live: 0, liveErrors: 0, liveEvents: 0, errorSamples: new Map() };
const timed = async (name, fn) => {
  const t = performance.now();
  stats.requests++;
  try {
    const { error } = await fn();
    if (error) throw error;
    stats.times.push(performance.now() - t);
  } catch (e) {
    stats.errors++;
    const msg = `${name}: ${e?.message ?? e}`.slice(0, 120);
    stats.errorSamples.set(msg, (stats.errorSamples.get(msg) ?? 0) + 1);
  }
};
const pct = (p) => {
  const a = [...stats.times].sort((x, y) => x - y);
  return a.length ? Math.round(a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]) : 0;
};
const jitter = (min, max) => min + Math.random() * (max - min);
const stopAt = Date.now() + DURATION;
const clients = [];

async function virtualUser() {
  const c = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  c.realtime.setAuth(token);
  clients.push(c);
  // Same live channels as the app (src/data/supabase/sessions.ts).
  const ch = c
    .channel(`lt-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => stats.liveEvents++)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_members' }, () => stats.liveEvents++)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => stats.liveEvents++);
  if (CHAT_SESSION) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${CHAT_SESSION}` }, () => stats.liveEvents++);
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') stats.live++;
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') stats.liveErrors++;
  });

  await timed('tracks', () => c.from('track_details').select('*').order('name'));
  let nextBoard = Date.now() + jitter(20_000, 60_000);
  while (Date.now() < stopAt) {
    await timed('session list', () => {
      let q = c.from('session_cards').select('*').is('cancelled_at', null).gt('starts_at', new Date().toISOString()).order('starts_at');
      if (cityId) q = q.eq('city_id', cityId);
      return q;
    });
    if (Date.now() > nextBoard) {
      await timed('leaderboard', () => c.rpc('leaderboard', { p_kind: 'global', p_city: null, p_track: null, p_season: null }));
      nextBoard = Date.now() + jitter(45_000, 75_000);
    }
    await new Promise((r) => setTimeout(r, jitter(15_000, 30_000)));
  }
}

console.log(`KartUP load test: ${USERS} people for ${DURATION / 1000}s against ${new URL(URL_).host}${CHAT_SESSION ? ', with chat' : ''}\n`);
const started = Date.now();
const report = setInterval(() => {
  console.log(
    `${Math.round((Date.now() - started) / 1000)}s  live: ${stats.live}/${clients.length} (failed ${stats.liveErrors})  requests: ${stats.requests}  errors: ${stats.errors}  p50 ${pct(50)} ms  p95 ${pct(95)} ms  live events: ${stats.liveEvents}`,
  );
}, 10_000);

let chat = null;
if (CHAT_SESSION) {
  let n = 0;
  chat = setInterval(() => void timed('chat', () => login.rpc('send_message', { p_session: CHAT_SESSION, p_body: `load test ${++n}` })), 10_000);
}

const runs = [];
for (let i = 0; i < USERS; i++) {
  runs.push(virtualUser());
  await new Promise((r) => setTimeout(r, 1000 / RAMP_PER_SEC));
}
await Promise.all(runs);
clearInterval(report);
if (chat) clearInterval(chat);

console.log('\n── Result ─────────────────────────────');
console.log(`People: ${USERS}   live connections OK: ${stats.live}   refused: ${stats.liveErrors}`);
console.log(`Requests: ${stats.requests}   errors: ${stats.errors} (${((stats.errors / Math.max(1, stats.requests)) * 100).toFixed(1)}%)`);
console.log(`Response time: p50 ${pct(50)} ms   p95 ${pct(95)} ms   p99 ${pct(99)} ms`);
for (const [msg, n] of stats.errorSamples) console.log(`  ${n}× ${msg}`);
const verdict = stats.errors === 0 && stats.liveErrors === 0 && pct(95) < 800 ? 'PASSED' : 'CHECK THE NUMBERS ABOVE';
console.log(`\n${verdict}`);
await Promise.all(clients.map((c) => c.removeAllChannels()));
process.exit(0);
