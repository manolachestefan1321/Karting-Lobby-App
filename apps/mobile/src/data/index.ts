/**
 * Picks the backend. EXPO_PUBLIC_DATA_SOURCE=mock (default) → in-browser fake backend
 * for the web preview. =supabase → real backend (finished in the next steps).
 * Screens only ever import `api` from here.
 */
import type { DataApi } from './api';

export const DATA_SOURCE = process.env.EXPO_PUBLIC_DATA_SOURCE === 'supabase' ? 'supabase' : 'mock';

export const api: DataApi =
  DATA_SOURCE === 'supabase'
    ? (require('./supabase') as typeof import('./supabase')).supabaseApi
    : (require('./mock') as typeof import('./mock')).mockApi;

export * from './api';
export * from './types';
