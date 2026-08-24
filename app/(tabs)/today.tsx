import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useAuth } from '@/store/auth';
import { fetchHistory, fetchOpenWorkout, createWorkout } from '@/lib/queries';
import { buildSessions, deriveProgram, nextWorkoutPlan } from '@/lib/program';
import { EXERCISES } from '@/lib/exercises';
import { fmtWeight } from '@/lib/weights';
import type { Workout } from '@/lib/types';
import { Badge, Button, Card } from '@/components/ui';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { colors, radius, space } from '@/theme';

export default function Today() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const unit = profile?.units ?? 'kg';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Workout | null>(null);
  const [program, setProgram] = useState<ReturnType<typeof deriveProgram> | null>(null);
  const [weekCount, setWeekCount] = useState(0);
  const [calcWeight, setCalcWeight] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!session || !profile) return;
    try {
      const [{ workouts, sets }, openWorkout] = await Promise.all([
        fetchHistory(session.user.id),
        fetchOpenWorkout(session.user.id),
      ]);
      const done = workouts.filter((w) => w.completed_at);
      const sessions = buildSessions(done, sets);
      setProgram(deriveProgram(profile.starting_weights, unit, sessions));
      setOpen(openWorkout);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      setWeekCount(
        done.filter((w) => new Date(w.completed_at ?? w.started_at).getTime() >= cutoff).length
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, profile, unit]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const start = async () => {
    if (!session || !program) return;
    setStarting(true);
    try {
      const plan = nextWorkoutPlan(program);
      const workout = await createWorkout(session.user.id, plan.day, plan.targets);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      router.push(`/workout/${workout.id}`);
    } finally {
      setStarting(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const completed = program ? program.totalSessions : 0;

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
          <Badge label={`${completed} SESSIONS`} tone="neutral" />
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
        ) : null}

        {program && !open ? (
          (() => {
            const plan = nextWorkoutPlan(program);
            return (
              <>
                <View style={{ flexDirection: 'row', gap: space(3) }}>
                  {[
                    { label: 'SESSIONS', value: String(completed) },
                    { label: 'NEXT DAY', value: plan.day },
                    { label: 'WEEK GOAL', value: `${Math.min(weekCount + 1, 3)}/3` },
                  ].map((s) => (
                    <View
                      key={s.label}
                      style={{
                        flex: 1,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        padding: space(3),
                        gap: 2,
                      }}
                    >
                      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                        {s.label}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{s.value}</Text>
                    </View>
                  ))}
                </View>

                <Card style={{ gap: space(3) }}>
                  <View>
                    <Badge label={`WORKOUT ${plan.day}`} tone="accent" />
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: space(2) }}>
                      {format(new Date(), 'EEEE, d MMMM')}
                    </Text>
                  </View>

                  <View style={{ gap: space(2) }}>
                    {plan.targets.map((t) => (
                      <View
                        key={t.lift}
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
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                            {EXERCISES[t.lift].name}
                          </Text>
                          <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2 }}>
                            {t.sets} × {t.reps}
                            {program.lifts[t.lift].fails > 0
                              ? ` · fail ${program.lifts[t.lift].fails}/3`
                              : ''}
                          </Text>
                        </View>
                        <Pressable hitSlop={8} onPress={() => setCalcWeight(t.weight)} style={{ marginRight: space(3) }}>
                          <Text style={{ color: colors.accent, fontSize: 18 }}>⌗</Text>
                        </Pressable>
                        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>
                          {fmtWeight(t.weight, unit)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Button
                    label={`Start Workout ${plan.day}`}
                    onPress={() => void start()}
                    loading={starting}
                  />
                </Card>
              </>
            );
          })()
        ) : null}

        <Card style={{ gap: space(1) }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>The rules</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21 }}>
            Hit all sets and reps → add {unit === 'kg' ? '2.5 kg' : '5 lb'} next time (deadlift{' '}
            {unit === 'kg' ? '5 kg' : '10 lb'}). Miss any reps → repeat the weight. Fail three times →
            deload 10% and build back up.
          </Text>
        </Card>
      </ScrollView>

      <PlateCalculatorModal visible={calcWeight != null} weight={calcWeight} unit={unit} onClose={() => setCalcWeight(null)} />
    </View>
  );
}
