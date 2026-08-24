import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/auth';
import {
  completeWorkout,
  discardWorkout,
  fetchWorkoutWithSets,
  logSet,
} from '@/lib/queries';
import { EXERCISES, liftsForDay } from '@/lib/exercises';
import { warmupSets } from '@/lib/warmups';
import { SMALLEST_PLATE, fmtWeight } from '@/lib/weights';
import type { WorkoutSet } from '@/lib/types';
import { Badge, Button, ConfirmDialog, Stepper } from '@/components/ui';
import { RestTimer } from '@/components/RestTimer';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { colors, radius, space } from '@/theme';

export default function WorkoutPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const unit = profile?.units ?? 'kg';

  const [workoutMeta, setWorkoutMeta] = useState<{
    day: 'A' | 'B';
    completed_at: string | null;
    started_at: string;
  } | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [logTarget, setLogTarget] = useState<WorkoutSet | null>(null);
  const [calcWeight, setCalcWeight] = useState<number | null>(null);
  const [restSec, setRestSec] = useState(0);
  const [restKey, setRestKey] = useState(0);
  const [warmDone, setWarmDone] = useState<Record<string, boolean>>({});
  const [warmOpen, setWarmOpen] = useState<Record<string, boolean>>({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchWorkoutWithSets(id);
        if (!active || !data) return;
        setWorkoutMeta({
          day: data.workout.day,
          completed_at: data.workout.completed_at,
          started_at: data.workout.started_at,
        });
        setSets(data.sets);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const readonly = !!workoutMeta?.completed_at;

  const groups = useMemo(() => {
    if (!workoutMeta) return [];
    return liftsForDay(workoutMeta.day).map((lift) => ({
      lift,
      def: EXERCISES[lift],
      sets: sets.filter((s) => s.exercise === lift).sort((a, b) => a.set_index - b.set_index),
    }));
  }, [workoutMeta, sets]);

  const loggedCount = sets.filter((s) => s.completed).length;

  const startRest = useCallback((seconds: number) => {
    setRestSec(seconds);
    setRestKey((k) => k + 1);
  }, []);

  const confirmLog = async (target: WorkoutSet, weight: number, reps: number) => {
    setSets((prev) =>
      prev.map((s) => (s.id === target.id ? { ...s, weight, reps, completed: true } : s))
    );
    setLogTarget(null);
    void Haptics.selectionAsync().catch(() => {});
    logSet(target.id, { weight, reps, completed: true }).catch(() => {});

    const flatOrder = groups.flatMap((g) => g.sets.map((s) => s.id));
    const idx = flatOrder.indexOf(target.id);
    const isLast = idx === flatOrder.length - 1;
    if (!isLast) {
      const groupOfTarget = groups.find((g) => g.lift === target.exercise)!;
      startRest(groupOfTarget.def.restSec);
    }
  };

  const finish = async () => {
    if (!workoutMeta) return;
    setFinishing(true);
    try {
      await completeWorkout(id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    await discardWorkout(id);
    router.replace('/(tabs)');
  };

  if (loading || !workoutMeta) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted }}>Loading workout…</Text>
      </View>
    );
  }

  const progressPct = sets.length > 0 ? Math.round((loggedCount / sets.length) * 100) : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ paddingTop: space(14), paddingHorizontal: space(5), gap: space(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            hitSlop={8}
            onPress={() => router.back()}
            style={{ padding: 4 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
              Workout {workoutMeta.day}
            </Text>
            <Text style={{ color: colors.faint, fontSize: 11 }}>
              {format(parseISO(workoutMeta.started_at), 'EEE d MMM · HH:mm')}
            </Text>
          </View>
          {!readonly ? (
            <Pressable hitSlop={8} onPress={() => setConfirmDiscard(true)} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          ) : (
            <Badge label="COMPLETED" tone="success" />
          )}
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <View
            style={{
              width: `${progressPct}%`,
              height: '100%',
              borderRadius: 2,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space(5), gap: space(4), paddingBottom: space(12) }}
      >
        {groups.map(({ lift, def, sets: rows }) => {
          const first = rows[0];
          const warmups = !readonly && first ? warmupSets(first.target_weight, unit) : [];
          const allDone = rows.every((r) => r.completed);
          return (
            <View
              key={lift}
              style={{
                backgroundColor: colors.surface,
                borderColor: allDone ? colors.successSoft : colors.border,
                borderWidth: 1,
                borderRadius: radius.lg,
                padding: space(4),
                gap: space(2.5),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2.5) }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    backgroundColor: colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 13 }}>
                    {def.short}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{def.name}</Text>
                  <Text style={{ color: colors.faint, fontSize: 12 }}>
                    {def.sets} × {def.reps} @ {fmtWeight(first?.target_weight ?? 0, unit)} · rest{' '}
                    {Math.round(def.restSec / 60)}m+
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setCalcWeight(first?.target_weight ?? null)}>
                  <Ionicons name="calculator-outline" size={22} color={colors.muted} />
                </Pressable>
              </View>

              {warmups.length > 0 ? (
                <View style={{ gap: space(1.5) }}>
                  <Pressable
                    hitSlop={6}
                    onPress={() => setWarmOpen((o) => ({ ...o, [lift]: !o[lift] }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons
                      name={warmOpen[lift] ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color={colors.faint}
                    />
                    <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>
                      WARMUP ({warmups.filter((_, i) => warmDone[`${lift}-${i}`]).length}/{warmups.length})
                    </Text>
                  </Pressable>
                  {warmOpen[lift]
                    ? warmups.map((wset, i) => {
                        const key = `${lift}-${i}`;
                        const done = !!warmDone[key];
                        return (
                          <Pressable
                            key={key}
                            disabled={readonly}
                            onPress={() => setWarmDone((d) => ({ ...d, [key]: !d[key] }))}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: space(2),
                              opacity: readonly ? 0.5 : 1,
                              paddingVertical: 2,
                            }}
                          >
                            <Ionicons
                              name={done ? 'checkmark-circle' : 'ellipse-outline'}
                              size={20}
                              color={done ? colors.success : colors.border}
                            />
                            <Text style={{ color: colors.muted, fontSize: 13 }}>
                              {fmtWeight(wset.weight, unit)} × {wset.reps}
                            </Text>
                          </Pressable>
                        );
                      })
                    : null}
                </View>
              ) : null}

              <View style={{ gap: space(1.5) }}>
                {rows.map((s) => {
                  const failed =
                    s.completed && s.reps != null && s.reps < s.target_reps;
                  return (
                    <Pressable
                      key={s.id}
                      disabled={readonly}
                      onPress={() => setLogTarget(s)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space(2.5),
                        backgroundColor:
                          s.completed && failed
                            ? colors.dangerSoft
                            : s.completed
                              ? colors.successSoft
                              : colors.surfaceAlt,
                        borderColor:
                          s.completed && failed
                            ? colors.danger
                            : s.completed
                              ? colors.success
                              : colors.border,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        padding: space(3),
                        opacity: pressed && !readonly ? 0.7 : 1,
                      })}
                    >
                      <Ionicons
                        name={
                          !s.completed
                            ? 'ellipse-outline'
                            : failed
                              ? 'close-circle'
                              : 'checkmark-circle'
                        }
                        size={24}
                        color={!s.completed ? colors.faint : failed ? colors.danger : colors.success}
                      />
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, minWidth: 52 }}>
                        Set {s.set_index}
                      </Text>
                      <Text style={{ color: s.completed ? colors.text : colors.muted, fontSize: 14, flex: 1 }}>
                        {fmtWeight(s.weight ?? s.target_weight, unit)} × {s.reps ?? s.target_reps}
                        {failed ? `  (missed ${s.target_reps - (s.reps ?? 0)})` : ''}
                      </Text>
                      {!readonly && !s.completed ? (
                        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
                          LOG
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {readonly ? (
          <Cardless note={`Finished ${format(parseISO(workoutMeta.completed_at ?? workoutMeta.started_at), 'EEE d MMM, HH:mm')}`} />
        ) : null}
      </ScrollView>

      {!readonly ? (
        <View style={{ paddingHorizontal: space(5), paddingBottom: space(4), gap: space(2.5) }}>
          {restSec > 0 ? (
            <RestTimer key={restKey} seconds={restSec} onDone={() => setRestSec(0)} onSkip={() => setRestSec(0)} />
          ) : null}
          <Button
            label={loggedCount < sets.length ? `Finish (${sets.length - loggedCount} unlogged)` : 'Finish workout'}
            variant="success"
            loading={finishing}
            onPress={() => (loggedCount < sets.length ? setConfirmFinish(true) : void finish())}
          />
        </View>
      ) : null}

      <Modal visible={logTarget != null} transparent animationType="slide" onRequestClose={() => setLogTarget(null)}>
        {logTarget ? (
          <LogSheet
            setName={`Set ${logTarget.set_index}`}
            exerciseName={EXERCISES[logTarget.exercise].name}
            initialWeight={logTarget.weight ?? logTarget.target_weight}
            initialReps={logTarget.target_reps}
            unit={unit}
            onCancel={() => setLogTarget(null)}
            onConfirm={(w, r) => void confirmLog(logTarget, w, r)}
          />
        ) : null}
      </Modal>

      <PlateCalculatorModal visible={calcWeight != null} weight={calcWeight} unit={unit} onClose={() => setCalcWeight(null)} />

      <ConfirmDialog
        visible={confirmFinish}
        title={`${sets.length - loggedCount} sets unlogged`}
        message="Unlogged sets count as missed. Finish anyway?"
        confirmLabel="Finish"
        danger
        onConfirm={() => {
          setConfirmFinish(false);
          void finish();
        }}
        onCancel={() => setConfirmFinish(false)}
      />
      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard workout?"
        message="All logged sets from this session will be deleted."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          void discard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Cardless({ note }: { note: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space(3),
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.faint, fontSize: 12 }}>{note}</Text>
    </View>
  );
}

function LogSheet({
  setName,
  exerciseName,
  initialWeight,
  initialReps,
  unit,
  onCancel,
  onConfirm,
}: {
  setName: string;
  exerciseName: string;
  initialWeight: number;
  initialReps: number;
  unit: string;
  onCancel: () => void;
  onConfirm: (weight: number, reps: number) => void;
}) {
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);

  return (
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
            {setName.toUpperCase()}
          </Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{exerciseName}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Weight</Text>
          <Stepper value={weight} onChange={setWeight} step={SMALLEST_PLATE[unit as 'kg'] * 2} min={0} suffix={unit} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Reps</Text>
          <Stepper value={reps} onChange={setReps} step={1} min={0} max={50} />
        </View>
        {reps < initialReps ? (
          <Text style={{ color: colors.warn, fontSize: 12, textAlign: 'center' }}>
            Below target — this counts as a failed set.
          </Text>
        ) : null}
        <Button label="Log set" variant="primary" onPress={() => onConfirm(weight, reps)} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
