/**
 * Store builds must use the real backend; the demo (fake users and data) is only
 * allowed in the `demo` and `development` build profiles.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  jest.resetModules();
});

function loadConfig(env: Record<string, string | undefined>) {
  process.env = { ...ENV, ...env };
  jest.resetModules(); // app.config reads the environment when it is loaded
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../app.config') as { default: (c: { config: object }) => { ios?: { bundleIdentifier?: string }; name: string } };
  return mod.default({ config: {} });
}

describe('build profiles', () => {
  it('refuses a production or preview build that would ship the demo', () => {
    expect(() => loadConfig({ EAS_BUILD_PROFILE: 'production', APP_VARIANT: 'production', EXPO_PUBLIC_DATA_SOURCE: undefined })).toThrow(/real backend/);
    expect(() => loadConfig({ EAS_BUILD_PROFILE: 'preview', APP_VARIANT: 'preview', EXPO_PUBLIC_DATA_SOURCE: 'mock' })).toThrow(/real backend/);
  });

  it('allows production with the real backend, and the demo profile with demo data', () => {
    expect(loadConfig({ EAS_BUILD_PROFILE: 'production', APP_VARIANT: 'production', EXPO_PUBLIC_DATA_SOURCE: 'supabase' }).ios?.bundleIdentifier).toBe('com.kartup.app');
    const demo = loadConfig({ EAS_BUILD_PROFILE: 'demo', APP_VARIANT: 'demo', EXPO_PUBLIC_DATA_SOURCE: 'mock' });
    expect(demo.ios?.bundleIdentifier).toBe('com.kartup.app.demo');
    expect(demo.name).toBe('KartUP Demo');
  });

  it('eas.json: store profiles use the real backend, only `demo` uses demo data', () => {
    const eas = JSON.parse(readFileSync(join(__dirname, '../../eas.json'), 'utf8')) as { build: Record<string, { env?: Record<string, string> }> };
    expect(eas.build.production!.env!.EXPO_PUBLIC_DATA_SOURCE).toBe('supabase');
    expect(eas.build.preview!.env!.EXPO_PUBLIC_DATA_SOURCE).toBe('supabase');
    expect(eas.build.demo!.env!.EXPO_PUBLIC_DATA_SOURCE).toBe('mock');
  });
});
