import { ApiError, type DataApi } from '../api';
import { MockServer, RANK_TIERS, RULES } from './server';

/**
 * The fake-backend instance of this browser tab, created on first use. (The preview's
 * outer page never touches it — only the app inside the phone frame does.)
 */
let instance: MockServer | null = null;
function getServer(): MockServer {
  if (!instance) {
    instance = new MockServer();
    // The real backend runs its scheduled jobs every minute; the preview re-checks often.
    const timer = setInterval(() => {
      const s = instance!;
      const fingerprint = () => `${s.db.notifications.length}|${s.db.sessions.map((x) => JSON.stringify(x.flags) + x.cancelledAt).join()}`;
      const before = fingerprint();
      s.tick();
      if (fingerprint() !== before) s.emit();
    }, 5000);
    (timer as { unref?: () => void }).unref?.(); // don't keep test runners alive
  }
  return instance;
}
export const server: MockServer = new Proxy({} as MockServer, {
  get(_target, key) {
    const s = getServer();
    const value = (s as unknown as Record<PropertyKey, unknown>)[key];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(s) : value;
  },
  set(_target, key, value) {
    (getServer() as unknown as Record<PropertyKey, unknown>)[key] = value;
    return true;
  },
});

/** Simulated network latency, so loading states are visible in the preview. */
const LATENCY = 150;
function call<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, LATENCY),
  );
}

/** Turns a picked image (blob:/file: URI) into a data: URL so it survives reloads. */
async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const mockApi: DataApi = {
  kind: 'mock',
  clock: {
    now: () => server.now(),
    subscribe: (cb) => server.on('clock', cb),
  },
  auth: {
    getUser: async () => {
      await server.ready;
      return call(() => {
        const u = server.db.currentUserId ? server.user(server.db.currentUserId) : undefined;
        return u && !u.deleted ? { id: u.id, email: u.email, provider: u.provider } : null;
      });
    },
    onChange: (cb) =>
      server.onAuth((event) => {
        const u = server.db.currentUserId ? server.user(server.db.currentUserId) : undefined;
        cb(u ? { id: u.id, email: u.email, provider: u.provider } : null, event);
      }),
    signInWithPassword: (email, password) => call(() => server.signIn(email, password)),
    signUp: ({ email, password, locale }) =>
      call(() => {
        server.signUp(email, password, locale);
        return { needsConfirmation: true };
      }),
    signInWithProvider: (provider) =>
      call(() => {
        server.socialSignIn(provider);
        return 'ok' as const;
      }),
    resendConfirmation: (email) => call(() => server.resendConfirmation(email)),
    requestPasswordReset: (email) => call(() => server.requestReset(email)),
    handleRedirect: (params) => call(() => server.handleRedirect(params.code)),
    updatePassword: (password) => call(() => server.updatePassword(password)),
    signOut: () => call(() => server.signOut()),
    deleteAccount: () => call(() => server.deleteAccount()),
  },
  profiles: {
    getMine: () => call(() => server.profile(server.me())),
    update: (input) => call(() => server.updateProfile(input)),
    uploadAvatar: async (uri) => {
      const url = await toDataUrl(uri);
      return call(() => server.setAvatar(url));
    },
    removeAvatar: () => call(() => server.setAvatar(null)),
    getPublic: (userId) => call(() => server.publicProfile(userId)),
    listExperience: (userId) =>
      call(() =>
        server.db.experience
          .filter((e) => e.userId === userId)
          .map((e) => ({ trackId: e.trackId, trackName: server.track(e.trackId).name, level: e.level, bestLapMs: e.bestLapMs, sessionsCount: e.sessionsCount }))
          .sort((a, b) => b.sessionsCount - a.sessionsCount),
      ),
    upsertExperience: (input) =>
      call(() => {
        const me = server.me();
        server.mutate(() => {
          const existing = server.db.experience.find((e) => e.userId === me.id && e.trackId === input.trackId);
          if (existing) Object.assign(existing, { level: input.level, bestLapMs: input.bestLapMs, sessionsCount: input.sessionsCount });
          else server.db.experience.push({ userId: me.id, trackId: input.trackId, level: input.level, bestLapMs: input.bestLapMs, sessionsCount: input.sessionsCount });
        });
      }),
    deleteExperience: (trackId) =>
      call(() => {
        const me = server.me();
        server.mutate(() => {
          server.db.experience = server.db.experience.filter((e) => !(e.userId === me.id && e.trackId === trackId));
        });
      }),
    progressHistory: (userId) => call(() => server.progressHistory(userId)),
    selfReport: (input) => call(() => server.selfReport(input)),
    setupPayouts: () => call(() => server.setupPayouts()),
    appealBan: (banId, message) => call(() => server.appealBan(banId, message)),
  },
  places: {
    rules: () => call(() => ({ ...RULES, demoInstantResults: server.db.instantResults })),
    cities: () => call(() => server.db.cities),
    tracks: (cityId) => call(() => server.db.tracks.filter((t) => !cityId || t.cityId === cityId).sort((a, b) => a.name.localeCompare(b.name))),
    track: (trackId) => call(() => server.db.tracks.find((t) => t.id === trackId) ?? null),
    rankTiers: () => call(() => RANK_TIERS),
  },
  sessions: {
    list: (filters) => call(() => server.listSessions(filters)),
    mine: () => call(() => server.mySessions()),
    get: (id) => call(() => (server.db.sessions.some((s) => s.id === id) ? server.kartSession(server.session(id)) : null)),
    create: (input) => call(() => server.createSession(input)),
    members: (id) =>
      call(() => {
        const s = server.session(id);
        return server.membersOf(id).map((m) => server.lobbyMember(m, s));
      }),
    enterLobby: (id) => call(() => server.enterLobby(id)),
    leaveLobby: (id) => call(() => server.leaveLobby(id)),
    cancelSeat: (id) => call(() => server.cancelSeat(id)),
    removeMember: (id, userId) => call(() => server.removeMember(id, userId)),
    cancelSession: (id, reason) => call(() => server.cancelSession(id, 'host', reason)),
    checkIn: (id) => call(() => server.checkIn(id)),
    confirmAttendance: (id, userId, attended) => call(() => server.confirmAttendance(id, userId, attended)),
    messages: (id) => call(() => server.messages(id)),
    sendMessage: (id, body) => call(() => server.sendMessage(id, body)),
  },
  payments: {
    createIntent: (sessionId) => call(() => server.createIntent(sessionId)),
    confirm: (intent, card) => new Promise((resolve, reject) => setTimeout(() => {
      try {
        resolve(server.confirmPayment(intent.paymentId, card));
      } catch (e) {
        reject(e);
      }
    }, 900)), // a card payment takes a moment
    history: () => call(() => server.paymentHistory()),
  },
  results: {
    get: (sessionId) => call(() => server.getResults(sessionId)),
    submit: async (sessionId, { entries, printoutUri }) => {
      const url = printoutUri ? await toDataUrl(printoutUri) : null;
      return call(() => server.submitResults(sessionId, entries, url));
    },
    respond: (sessionId, response, comment) => call(() => server.respondResults(sessionId, response, comment ?? null)),
  },
  ranking: {
    leaderboard: (scope) => call(() => server.leaderboard(scope)),
    seasons: () => call(() => server.seasons()),
  },
  admin: {
    pendingSelfReports: () => call(() => server.pendingSelfReports()),
    reviewSelfReport: (id, approve) => call(() => server.reviewSelfReport(id, approve)),
    setOfficialEvent: (sessionId, official) => call(() => server.setOfficialEvent(sessionId, official)),
    sessions: () => call(() => server.adminSessions()),
  },
  notifications: {
    list: () =>
      call(() => {
        const me = server.me();
        return server.db.notifications
          .filter((n) => n.userId === me.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map(({ userId: _u, ...n }) => n);
      }),
    markAllRead: () =>
      call(() => {
        const me = server.me();
        server.mutate(() => {
          for (const n of server.db.notifications) if (n.userId === me.id && !n.readAt) n.readAt = server.now().toISOString();
        });
      }),
    markRead: (id) =>
      call(() => {
        const n = server.db.notifications.find((x) => x.id === id);
        if (n && !n.readAt) server.mutate(() => (n.readAt = server.now().toISOString()));
      }),
    prefs: () => call(() => server.me().prefs),
    setPrefs: (prefs) =>
      call(() => {
        const me = server.me();
        server.mutate(() => (me.prefs = { ...prefs, account: true }));
      }),
    onNew: (cb) => server.onNotification(cb),
  },
  moderation: {
    report: (target, reason) =>
      call(() => {
        const me = server.me();
        server.mutate(() => {
          server.db.reports.push({ id: `r-${server.db.reports.length + 1}`, reporterId: me.id, target, reason, createdAt: server.now().toISOString(), status: 'open' });
        });
      }),
    block: (userId) =>
      call(() => {
        const me = server.me();
        if (userId === me.id) throw new ApiError('cannot_block_self');
        server.mutate(() => {
          if (!me.blocked.includes(userId)) me.blocked.push(userId);
        });
      }),
    unblock: (userId) =>
      call(() => {
        const me = server.me();
        server.mutate(() => (me.blocked = me.blocked.filter((x) => x !== userId)));
      }),
    blocked: () => call(() => server.me().blocked),
  },
  realtime: {
    subscribe: (topic, cb) => server.on(topic, cb),
  },
  location: {
    current: () => call(() => server.simulatedPosition()),
  },
};
