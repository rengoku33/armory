import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

export default function AuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const query = new URLSearchParams();
        for (const key of Object.keys(params)) {
          query.set(key, String(params[key]));
        }
        const url = `armory://auth/callback?${query.toString()}`;
        const parsed = QueryParams.getQueryParams(url);
        const access_token = parsed.params.access_token;
        const refresh_token = parsed.params.refresh_token;

        if (access_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token ?? '',
          });
          if (!error) {
            router.replace('/');
            return;
          }
        }
      } catch {
        /* fall through to error state */
      }
      router.replace('/login');
    })();
  }, [params]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space(3),
      }}
    >
      <Text style={{ color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: 3 }}>
        ARMORY
      </Text>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
