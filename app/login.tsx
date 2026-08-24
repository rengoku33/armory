import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/oauth';
import { Button, Field } from '@/components/ui';
import { colors, space } from '@/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  useEffect(() => {
    void WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      void WebBrowser.coolDownAsync().catch(() => {});
    };
  }, []);

  const googleSignIn = async () => {
    setError(null);
    setOauthBusy(true);
    const result = await signInWithGoogle();
    setOauthBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/');
  };

  const emailSignIn = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space(6),
          justifyContent: 'center',
          gap: space(4),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space(1), marginBottom: space(2) }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 3 }}>
            STRONGLIFTS 5×5
          </Text>
          <Text style={{ color: colors.text, fontSize: 38, fontWeight: '900' }}>Armory</Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            Squat. Bench. Press. Row. Deadlift. Progress.
          </Text>
        </View>

        <Button label="Continue with Google" onPress={() => void googleSignIn()} loading={oauthBusy} variant="ghost" />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.faint, fontSize: 12 }}>or use email</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <Field label="Email" value={email} onChangeText={setEmail} inputMode="email" placeholder="you@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}

        <Button label="Sign in" onPress={() => void emailSignIn()} loading={busy} disabled={!email || !password} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text style={{ color: colors.muted }}>No account?</Text>
          <Link href="/signup" asChild>
            <Pressable hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Create one</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
