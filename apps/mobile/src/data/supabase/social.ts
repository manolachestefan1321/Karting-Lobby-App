import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { env } from './env';
import { supabase } from './client';
import { authRedirectUrl } from './redirect';

export type SocialResult = 'ok' | 'cancelled';

WebBrowser.maybeCompleteAuthSession();

let googleConfigured = false;

/**
 * The native Google module exists only in real builds (EAS), not in Expo Go or on the web.
 * It's loaded on demand so the app can still run there (Google then signs in through the browser).
 */
const nativeGoogleAvailable = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
function googleModule(): GoogleModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin') as GoogleModule;
}

/** Google: native account picker → ID token → Supabase session. */
export async function signInWithGoogle(): Promise<SocialResult> {
  if (!nativeGoogleAvailable) return signInWithOAuthBrowser('google');
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = googleModule();
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: env.googleWebClientId, iosClientId: env.googleIosClientId || undefined });
    googleConfigured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return 'cancelled';
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('google_no_id_token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return 'ok';
  } catch (err) {
    if (isErrorWithCode(err) && (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS)) {
      return 'cancelled';
    }
    throw err;
  }
}

/** Apple: native sheet on iOS (required by App Store rules when other social logins exist). */
export async function signInWithApple(): Promise<SocialResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('apple_no_identity_token');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;

    // Apple shares the name only on the very first sign-in: save it right away.
    const given = credential.fullName?.givenName;
    const family = credential.fullName?.familyName;
    if (data.user && (given || family)) {
      await supabase
        .from('profiles')
        .update({ first_name: given ?? undefined, last_name: family ?? undefined })
        .eq('id', data.user.id)
        .is('first_name', null);
    }
    return 'ok';
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw err;
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

/** Facebook (and web fallback): system browser sheet → redirect with ?code → session. */
export async function signInWithOAuthBrowser(provider: 'facebook' | 'google'): Promise<SocialResult> {
  const redirectTo = authRedirectUrl();
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
    return 'ok';
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true, scopes: provider === 'facebook' ? 'email,public_profile' : undefined },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('oauth_no_code');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return 'ok';
}

export async function signOutEverywhere() {
  if (nativeGoogleAvailable) {
    try {
      const { GoogleSignin } = googleModule();
      if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut();
    } catch {
      // Not signed in with Google — nothing to do.
    }
  }
  await supabase.auth.signOut();
}
