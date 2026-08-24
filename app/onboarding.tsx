import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/auth';
import { saveOnboarding } from '@/lib/queries';
import { DEFAULT_STARTING, incrementFor } from '@/lib/program';
import { EXERCISES, LIFT_ORDER } from '@/lib/exercises';
import { SMALLEST_PLATE, fmtWeight } from '@/lib/weights';
import type { LiftId, Unit } from '@/lib/types';
import { Button, Stepper } from '@/components/ui';
import { colors, radius, space } from '@/theme';

function Dot({ active }: { active: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: active ? colors.accent : colors.border,
      }}
    />
  );
}

export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>('kg');
  const [weights, setWeights] = useState<Record<LiftId, number>>({ ...DEFAULT_STARTING.kg });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseUnit = (u: Unit) => {
    setUnit(u);
    setWeights({ ...DEFAULT_STARTING[u] });
    setStep(1);
  };

  const finish = async () => {
    if (!session) return;
    setError(null);
    setBusy(true);
    try {
      await saveOnboarding(session.user.id, unit, weights);
      await refreshProfile();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
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
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Dot active={step === 0} />
        <Dot active={step === 1} />
      </View>

      {step === 0 ? (
        <>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>Welcome</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
            Armory runs the StrongLifts 5×5 program: alternate workouts A and B three times a week.
            Every successful session adds weight automatically. Pick how you count your iron.
          </Text>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            {(['kg', 'lbs'] as Unit[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => chooseUnit(u)}
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
        </>
      ) : (
        <>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>Starting weights</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
            Begin light — the bar alone is fine. You will add {unit === 'kg' ? '+2.5 kg' : '+5 lb'} per
            session on every lift{unit === 'kg' ? '' : ''}, and double that on deadlifts.
          </Text>
          <View style={{ gap: space(3) }}>
            {LIFT_ORDER.map((lift) => (
              <View
                key={lift}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: space(3),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                    {EXERCISES[lift].name}
                  </Text>
                  <Text style={{ color: colors.faint, fontSize: 11 }}>
                    +{fmtWeight(incrementFor(lift, unit), unit)} per session · {EXERCISES[lift].sets}×{EXERCISES[lift].reps}
                  </Text>
                </View>
                <Stepper
                  value={weights[lift]}
                  onChange={(v) => setWeights((w) => ({ ...w, [lift]: v }))}
                  step={SMALLEST_PLATE[unit] * 2}
                  min={0}
                  suffix={unit}
                />
              </View>
            ))}
          </View>
          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        </>
      )}

      <View style={{ flexDirection: 'row', gap: space(3), marginTop: space(4) }}>
        {step === 1 ? (
          <Button label="Back" variant="ghost" onPress={() => setStep(0)} style={{ flex: 1 }} />
        ) : null}
        <Button
          label={step === 0 ? 'Continue' : 'Start lifting'}
          onPress={() => (step === 0 ? setStep(1) : void finish())}
          loading={busy}
          style={{ flex: step === 0 ? 0 : 1 }}
        />
      </View>
    </ScrollView>
  );
}
