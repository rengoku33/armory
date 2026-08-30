import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/auth';
import { saveOnboarding } from '@/lib/queries';
import type { Unit } from '@/lib/types';
import { Button } from '@/components/ui';
import { colors, radius, space } from '@/theme';

export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const [unit, setUnit] = useState<Unit>('kg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    if (!session) return;
    setError(null);
    setBusy(true);
    try {
      await saveOnboarding(session.user.id, unit);
      await refreshProfile();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)/today');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your setup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: colors.bg,
        padding: space(6),
        paddingTop: space(16),
        gap: space(4),
      }}
    >
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>Welcome</Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
        Armory runs you through workouts A and B: Squat, Bench and Overhead Press on A; Squat,
        Barbell Row and Deadlift on B. You can add your own exercises to either day in the Edit
        Workout screen, and every weight is yours to choose when you log. Pick how you count your
        iron.
      </Text>

      <View style={{ flexDirection: 'row', gap: space(3) }}>
        {(['kg', 'lbs'] as Unit[]).map((u) => (
          <Pressable
            key={u}
            onPress={() => setUnit(u)}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: unit === u ? colors.accentSoft : colors.surface,
              borderColor: unit === u ? colors.accent : colors.border,
              borderWidth: 2,
              borderRadius: radius.lg,
              alignItems: 'center',
              paddingVertical: space(7),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: unit === u ? colors.accent : colors.muted,
                fontSize: 26,
                fontWeight: '900',
              }}
            >
              {u.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}

      <Button label="Start lifting" onPress={() => void finish()} loading={busy} />
    </ScrollView>
  );
}
