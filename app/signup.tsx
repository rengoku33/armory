import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/oauth';
import { Button, Field } from '@/components/ui';
import { colors, space } from '@/theme';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

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

  const emailSignUp = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data.session) {
      setInfo('Check your inbox and confirm your email, then sign in.');
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
          <Text style={{ color: colors.text, fontSize: 38, fontWeight: '900' }}>Join Armory</Text>
        </View>

        <Button label="Continue with Google" onPress={() => void googleSignIn()} loading={oauthBusy} variant="ghost" />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.faint, fontSize: 12 }}>or use email</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <Field label="Email" value={email} onChangeText={setEmail} inputMode="email" placeholder="you@example.com" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 6 characters"
        />

        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        {info ? <Text style={{ color: colors.success, fontSize: 13 }}>{info}</Text> : null}

        <Button label="Create account" onPress={() => void emailSignUp()} loading={busy} disabled={!email || password.length < 6} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Text style={{ color: colors.muted }}>Already lifting?</Text>
          <Link href="/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
