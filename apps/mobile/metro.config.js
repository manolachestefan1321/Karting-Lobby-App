// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Demo isolation: a build against the real backend (EXPO_PUBLIC_DATA_SOURCE=supabase)
 * gets EMPTY modules instead of the demo backend and its fake data (src/data/mock),
 * so no demo users, results or ranks can ever ship in a real app.
 * Screens only reach the demo through `api.kind === 'mock'` checks, which are false there.
 */
if (process.env.EXPO_PUBLIC_DATA_SOURCE === 'supabase') {
  const demoDir = path.join(__dirname, 'src', 'data', 'mock') + path.sep;
  const resolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const result = resolve ? resolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
    if (result.type === 'sourceFile' && result.filePath.startsWith(demoDir)) return { type: 'empty' };
    return result;
  };
}

module.exports = config;
