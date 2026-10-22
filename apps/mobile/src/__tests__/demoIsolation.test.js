/**
 * Demo data must never reach the real backend: the Supabase seed and migrations
 * contain none of the demo people or their generated history. (Real-backend app
 * builds get empty modules instead of src/data/mock — see metro.config.js.)
 */
const { readdirSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

it('the real database seed and migrations contain no demo data', () => {
  const root = join(__dirname, '../../../../supabase');
  const files = [join(root, 'seed.sql'), ...readdirSync(join(root, 'migrations')).map((f) => join(root, 'migrations', f))].filter(existsSync);
  expect(files.length).toBeGreaterThan(1);
  const sql = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const marker of ['kartup.test', 'u-andrei', 'Popescu', 'timing_sheet']) expect(sql).not.toContain(marker);
});

it('real-backend builds swap the demo backend for empty modules', () => {
  const metro = readFileSync(join(__dirname, '../../metro.config.js'), 'utf8');
  expect(metro).toContain("EXPO_PUBLIC_DATA_SOURCE === 'supabase'");
  expect(metro).toContain("path.join(__dirname, 'src', 'data', 'mock')");
  expect(metro).toContain("{ type: 'empty' }");
});
