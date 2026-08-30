import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { addDays, format } from 'date-fns';
import { useAuth } from '@/store/auth';
import {
  createWorkout,
  fetchHistory,
  fetchLastWeights,
  fetchOpenWorkout,
  fetchTemplates,
} from '@/lib/queries';
import { buildPlan, nextDay } from '@/lib/program';
import { SMALLEST_PLATE, fmtWeight } from '@/lib/weights';
import type { PlannedExercise, Workout, WorkoutDay, WorkoutTemplate } from '@/lib/types';
import { Badge, Button, Card, Segmented, Stepper } from '@/components/ui';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { colors, radius, space } from '@/theme';

export default function Today() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const unit = profile?.units ?? 'kg';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Workout | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({});
  const [sessionCount, setSessionCount] = useState(0);
  const [next, setNext] = useState<WorkoutDay>('A');
  const [pickedDay, setPickedDay] = useState<WorkoutDay>('A');
  const [pickedDate, setPickedDate] = useState<Date>(new Date());
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [weightEdit, setWeightEdit] = useState<{ key: string; name: string; weight: number } | null>(null);
  const [calcWeight, setCalcWeight] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const temps = await fetchTemplates(session.user.id);
      const { workouts } = await fetchHistory(session.user.id);
      const weights = await fetchLastWeights(session.user.id);
      const openWorkout = await fetchOpenWorkout(session.user.id);

      const completed = workouts.filter((w) => w.completed_at);
      const lastDay = completed.length > 0 ? completed[0].day : null;

      setTemplate(temps);
      setLastWeights(weights);
      setNext(nextDay(lastDay));
      setPickedDay(nextDay(lastDay));
      setSessionCount(completed.length);
      setOpen(openWorkout);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const currentPlan = (): PlannedExercise[] => {
    if (!template) return [];
    const base = buildPlan(pickedDay === 'A' ? template.A : template.B, lastWeights);
    return base.map((p) => (overrides[p.key] != null ? { ...p, weight: overrides[p.key] } : p));
  };

  const start = async () => {
    if (!session || !template) return;
    const plan = currentPlan();
    if (plan.length === 0) return;
    setStarting(true);
    try {
      const workout = await createWorkout(session.user.id, pickedDay, plan, pickedDate);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      router.push(`/workout/${workout.id}`);
    } finally {
      setStarting(false);
    }
  };

  if (loading || !profile || !template) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const plan = currentPlan();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: space(5), paddingTop: space(16), gap: space(4), paddingBottom: space(10) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: 1 }}>
            ARMORY
          </Text>
          <Badge label={`${sessionCount} SESSIONS`} tone="neutral" />
        </View>

        {open ? (
          <Card style={{ borderColor: colors.warn }}>
            <Text style={{ color: colors.warn, fontWeight: '800', marginBottom: 4 }}>
              WORKOUT IN PROGRESS
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: space(3) }}>
              You have an unfinished Workout {open.day}. Finish or discard it before starting a new one.
            </Text>
            <Button
              label={`Resume Workout ${open.day}`}
              onPress={() => router.push(`/workout/${open.id}`)}
              variant="ghost"
            />
          </Card>
        ) : (
          <Card style={{ gap: space(3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Log a workout</Text>
              <Pressable hitSlop={8} onPress={() => router.push('/edit-workout')}>
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>EDIT</Text>
              </Pressable>
            </View>

            <View style={{ gap: space(1.5) }}>
              <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                WHICH DAY {pickedDay !== next ? '· off-schedule' : ''}
              </Text>
              <Segmented<WorkoutDay>
                options={[
                  { value: 'A', label: 'Workout A' },
                  { value: 'B', label: 'Workout B' },
                ]}
                value={pickedDay}
                onChange={setPickedDay}
              />
            </View>

            <DateStrip selected={pickedDate} onSelect={setPickedDate} />

            {plan.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Workout {pickedDay} is empty. Add exercises in Edit Workout to get started.
              </Text>
            ) : (
              <View style={{ gap: space(2) }}>
                {plan.map((t) => (
                  <View
                    key={t.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radius.md,
                      paddingHorizontal: space(3),
                      paddingVertical: space(2.5),
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t.name}</Text>
                      <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2 }}>
                        {t.sets} × {t.reps}
                      </Text>
                    </View>
                    {overrides[t.key] != null ? (
                      <Badge label="ADJUSTED" tone="accent" />
                    ) : null}
                    <Pressable hitSlop={8} onPress={() => setCalcWeight(t.weight)} style={{ marginHorizontal: space(2) }}>
                      <Text style={{ color: colors.accent, fontSize: 18 }}>⌗</Text>
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      onPress={() => setWeightEdit({ key: t.key, name: t.name, weight: t.weight })}
                      style={{
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        paddingHorizontal: space(2.5),
                        paddingVertical: space(1),
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
                        {t.weight > 0 ? fmtWeight(t.weight, unit) : '—'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <Button
              label={`Log Workout ${pickedDay} · ${format(pickedDate, 'd MMM')}`}
              onPress={() => void start()}
              loading={starting}
              disabled={plan.length === 0}
            />
            <Text style={{ color: colors.faint, fontSize: 11, textAlign: 'center' }}>
              Pick any day to backfill a missed workout, or leave it on today.
            </Text>
          </Card>
        )}

        <Card style={{ gap: space(1) }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>How logging works</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21 }}>
            Tap a set to log it as complete at the suggested weight (your last working weight).
            Long-press a set to adjust its weight or reps. Weights are yours — no forced increases.
          </Text>
        </Card>
      </ScrollView>

      <PlateCalculatorModal visible={calcWeight != null} weight={calcWeight} unit={unit} onClose={() => setCalcWeight(null)} />

      <Modal visible={weightEdit != null} transparent animationType="slide" onRequestClose={() => setWeightEdit(null)}>
        {weightEdit ? (
          <View style={{ flex: 1, backgroundColor: 'rgba(4,6,10,0.72)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.lg + 4,
                borderTopRightRadius: radius.lg + 4,
                borderWidth: 1,
                borderColor: colors.border,
                padding: space(6),
                paddingBottom: space(10),
                gap: space(4),
              }}
            >
              <View>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
                  WEIGHT FOR THIS WORKOUT
                </Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{weightEdit.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.muted, fontWeight: '700' }}>Working weight</Text>
                <Stepper value={weightEdit.weight} step={SMALLEST_PLATE[unit as 'kg'] * 2} min={0} suffix={unit} onChange={(v) => setWeightEdit({ ...weightEdit, weight: v })} />
              </View>
              <Button
                label="Use this weight"
                variant="primary"
                onPress={() => {
                  if (weightEdit) setOverrides((o) => ({ ...o, [weightEdit.key]: weightEdit.weight }));
                  setWeightEdit(null);
                }}
              />
              <Button label="Cancel" variant="ghost" onPress={() => setWeightEdit(null)} />
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function DateStrip({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 27; i >= 0; i--) out.push(addDays(new Date(), -i));
    return out;
  }, []);
  const selectedKey = format(selected, 'yyyy-MM-dd');

  return (
    <View>
      <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: space(1.5) }}>
        WHICH DATE
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space(1.5), paddingVertical: 2 }}
      >
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const active = key === selectedKey;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(d)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: space(2.5),
                paddingVertical: space(1.5),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.border,
                backgroundColor: active ? colors.accentSoft : colors.surfaceAlt,
                minWidth: 56,
              }}
            >
              <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '700' }}>
                {format(d, 'EEE')}
              </Text>
              <Text style={{ color: active ? colors.accent : colors.text, fontSize: 16, fontWeight: '800' }}>
                {format(d, 'd')}
              </Text>
              <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '700' }}>
                {format(d, 'MMM')}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => onSelect(new Date())}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space(2.5),
            paddingVertical: space(1.5),
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.accent,
            backgroundColor: colors.accentSoft,
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>TODAY</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
