// App entry: add the missing Intl APIs before anything else runs, then start Expo Router.
import './src/lib/intlPolyfills';
import 'expo-router/entry';
