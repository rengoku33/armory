import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/auth';
import { updateUnits } from '@/lib/queries';
import type { Unit } from '@/lib/types';
import { Button, Card, ConfirmDialog, Segmented } from '@/components/ui';
import { colors, space } from '@/theme';

export default function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const changeUnits = async (u: Unit) => {
    if (!session || !profile || profile.units === u) return;
    await updateUnits(session.user.id, u);
    await refreshProfile();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(5), paddingTop: space(16), gap: space(4), paddingBottom: space(10) }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>Settings</Text>

        <Card style={{ gap: space(2) }}>
          <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>ACCOUNT</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {session?.user.email ?? 'Signed in'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            All workouts are stored in your Supabase account and synced to this user only.
          </Text>
        </Card>

        <Card style={{ gap: space(3) }}>
          <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
            UNITS
          </Text>
          <Segmented<Unit>
            options={[
              { value: 'kg', label: 'Kilograms' },
              { value: 'lbs', label: 'Pounds' },
            ]}
            value={profile?.units ?? 'kg'}
            onChange={(u) => void changeUnits(u)}
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Progression steps become {profile?.units === 'lbs' ? '+5 lb (+10 lb deadlift)' : '+2.5 kg (+5 kg deadlift)'}.
            Past sessions keep the numbers they were logged with.
          </Text>
        </Card>

        <Card style={{ gap: space(2) }}>
          <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
            REST TIMER DEFAULTS
          </Text>
          {[
            ['Squat / Bench / OHP', '2:30'],
            ['Barbell Row', '1:30'],
            ['Deadlift', '3:00'],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted }}>{k}</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{v}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ gap: space(1) }}>
          <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
            PROGRAM
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21 }}>
            StrongLifts 5×5 · alternate A and B, three sessions a week.{'\n'}
            A — Squat, Bench Press, Row · 5×5{'\n'}
            B — Squat, Overhead Press, Deadlift 1×5{'\n'}
            Fail three sessions at a weight → deload 10%.
          </Text>
        </Card>

        <Button
          label="Sign out"
          variant="danger"
          onPress={() => setConfirmSignOut(true)}
        />

        <Text style={{ color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: space(4) }}>
          Armory 0.1.0
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="Your workout history stays safe in your account."
        confirmLabel="Sign out"
        danger
        onConfirm={() => {
          setConfirmSignOut(false);
          void Haptics.selectionAsync().catch(() => {});
          void signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </View>
  );
}
