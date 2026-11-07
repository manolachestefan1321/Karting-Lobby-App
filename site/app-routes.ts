/**
 * Addresses served by the app (app.html) on the website; / and /join are the waitlist page.
 * Kept in sync with apps/mobile/src/app by apps/mobile/src/__tests__/siteRoutes.test.ts.
 */
export const APP_ROUTES = [
  '/welcome', '/sign-in', '/sign-up', '/forgot-password', '/verify-email', '/reset-password', '/auth/*', '/onboarding',
  '/sessions', '/leaderboard', '/create', '/notifications', '/profile', '/profile/*', '/settings', '/settings/*',
  '/session/*', '/user/*', '/admin', '/admin/*', '/partner', '/partner/*', '/legal/*', '/dev',
];
