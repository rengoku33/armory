import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { supabaseConfigured, SUPABASE_URL } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui';
import { colors, space } from '@/theme';

function Splash() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space(4),
      }}
    >
      <Text style={{ color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: 3 }}>
        ARMORY
      </Text>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function SetupNotice() {
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: colors.bg,
        padding: space(6),
        justifyContent: 'center',
        gap: space(3),
      }}
    >
      <Text style={{ color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: 3 }}>
        ARMORY
      </Text>
      <Text style={{ color: colors.warn, fontWeight: '800' }}>Supabase not configured</Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
        1. Create a project at supabase.com{'\n'}
        2. Copy .env.example to .env and fill in your project URL and anon key{'\n'}
        3. Run supabase/migrations/0001_init.sql in the SQL editor{'\n'}
        4. Restart this app{'\n'}
        {'\n'}Current URL: {SUPABASE_URL || '(empty)'}
      </Text>
    </ScrollView>
  );
}

export default function Index() {
  const { loading, session, profile, signOut } = useAuth();

  if (!supabaseConfigured) return <SetupNotice />;
  if (loading) return <Splash />;
  if (!session) return <Redirect href="/login" />;
  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(4),
          padding: space(6),
        }}
      >
        <Text style={{ color: colors.muted, textAlign: 'center' }}>
          Could not load your profile.
        </Text>
        <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
      </View>
    );
  }
  if (!profile.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
