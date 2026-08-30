import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export interface OAuthResult {
  error: string | null;
}

export function oauthRedirectUri(): string {
  return makeRedirectUri({ native: 'armory://auth/callback', path: 'auth/callback' });
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  try {
    const redirectTo = oauthRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start Google sign-in.' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success' || !res.url) {
      return { error: null };
    }

    const params = QueryParams.getQueryParams(res.url);
    const access_token = params.params.access_token;
    const refresh_token = params.params.refresh_token;
    if (!access_token) return { error: 'Google sign-in did not return a session.' };

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? '',
    });
    if (sessionError) return { error: sessionError.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Google sign-in failed.' };
  }
}
