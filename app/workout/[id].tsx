import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  deleteSet,
  discardWorkout,
  fetchWorkoutWithSets,
  logSet,
} from '@/lib/queries';
import { SMALLEST_PLATE, fmtWeight } from '@/lib/weights';
import type { WorkoutSet } from '@/lib/types';
import { Badge, Button, ConfirmDialog, Stepper } from '@/components/ui';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { colors, radius, space } from '@/theme';

interface Group {
  key: string;
  name: string;
  sets: WorkoutSet[];
}

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
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmSetDelete, setConfirmSetDelete] = useState<WorkoutSet | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Guard against onPress firing right after onLongPress.
  const longFired = useRef(false);

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

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      const arr = map.get(s.exercise) ?? [];
      arr.push(s);
      map.set(s.exercise, arr);
    }
    return [...map.entries()].map(([key, rows]) => ({
      key,
      name: rows[0].exercise_name,
      sets: [...rows].sort((a, b) => a.set_index - b.set_index),
    }));
  }, [sets]);

  const loggedCount = sets.filter((s) => s.completed).length;

  // One-tap log: mark complete at the target (suggested) weight and reps.
  const quickLog = async (target: WorkoutSet) => {
    setSets((prev) =>
      prev.map((s) =>
        s.id === target.id
          ? {
              ...s,
              weight: s.weight ?? s.target_weight,
              reps: s.reps ?? s.target_reps,
              completed: true,
            }
          : s
      )
    );
    void Haptics.selectionAsync().catch(() => {});
    logSet(target.id, {
      weight: target.weight ?? target.target_weight,
      reps: target.reps ?? target.target_reps,
      completed: true,
    }).catch(() => {});
  };

  const confirmLog = async (target: WorkoutSet, weight: number, reps: number) => {
    setSets((prev) =>
      prev.map((s) => (s.id === target.id ? { ...s, weight, reps, completed: true } : s))
    );
    setLogTarget(null);
    void Haptics.selectionAsync().catch(() => {});
    logSet(target.id, { weight, reps, completed: true }).catch(() => {});
  };

  const deleteOneSet = async (target: WorkoutSet) => {
    setSets((prev) => prev.filter((s) => s.id !== target.id));
    setConfirmSetDelete(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    deleteSet(target.id).catch(() => {});
  };

  const finish = async () => {
    if (!workoutMeta) return;
    setFinishing(true);
    try {
      await completeWorkout(id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)/today');
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    await discardWorkout(id);
    router.replace('/(tabs)/today');
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
          <Pressable hitSlop={8} onPress={() => router.back()} style={{ padding: 4 }}>
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
          {readonly ? <Badge label="COMPLETED" tone="success" /> : null}
          <Pressable hitSlop={8} onPress={() => setConfirmDiscard(true)} style={{ padding: 4, marginLeft: 6 }}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
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
        {groups.map(({ key, name, sets: rows }) => {
          const allDone = rows.every((r) => r.completed);
          return (
            <View
              key={key}
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
                  <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 12 }}>
                    {rows[0].exercise_name.slice(0, 3).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{name}</Text>
                  <Text style={{ color: colors.faint, fontSize: 12 }}>
                    {rows.length} × {rows[0].target_reps} @ {fmtWeight(rows[0].target_weight, unit)}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setCalcWeight(rows[0].target_weight)}>
                  <Ionicons name="calculator-outline" size={22} color={colors.muted} />
                </Pressable>
              </View>

              <View style={{ gap: space(1.5) }}>
                {rows.map((s) => {
                  const failed = s.completed && s.reps != null && s.reps < s.target_reps;
                  return (
                    <Pressable
                      key={s.id}
                      delayLongPress={350}
                      onPressIn={() => {
                        longFired.current = false;
                      }}
                      onLongPress={() => {
                        longFired.current = true;
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setLogTarget(s);
                      }}
                      onPress={() => {
                        if (longFired.current) return;
                        if (!readonly && !s.completed) {
                          void quickLog(s);
                          return;
                        }
                        setLogTarget(s);
                      }}
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
                        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 11 }}>
                          TAP
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {!readonly ? (
        <View style={{ paddingHorizontal: space(5), paddingBottom: space(4), gap: space(2.5) }}>
          <Button
            label={loggedCount < sets.length ? `Finish (${sets.length - loggedCount} unlogged)` : 'Finish workout'}
            variant="success"
            loading={finishing}
            onPress={() => (loggedCount < sets.length ? setConfirmFinish(true) : void finish())}
          />
          <Text style={{ color: colors.faint, fontSize: 11, textAlign: 'center' }}>
            Tap a set to log it as {unit === 'kg' ? 'the target weight' : 'the target weight'}. Long-press to adjust.
          </Text>
        </View>
      ) : null}

      <Modal visible={logTarget != null} transparent animationType="slide" onRequestClose={() => setLogTarget(null)}>
        {logTarget ? (
          <LogSheet
            setName={`Set ${logTarget.set_index}`}
            exerciseName={logTarget.exercise_name}
            initialWeight={logTarget.weight ?? logTarget.target_weight}
            initialReps={logTarget.reps ?? logTarget.target_reps}
            unit={unit}
            onCancel={() => setLogTarget(null)}
            onConfirm={(w, r) => void confirmLog(logTarget, w, r)}
            onDelete={() => {
              const t = logTarget;
              setLogTarget(null);
              setConfirmSetDelete(t);
            }}
          />
        ) : null}
      </Modal>

      <PlateCalculatorModal visible={calcWeight != null} weight={calcWeight} unit={unit} onClose={() => setCalcWeight(null)} />

      <ConfirmDialog
        visible={confirmFinish}
        title={`${sets.length - loggedCount} sets unlogged`}
        message="Unlogged sets stay empty in your history. Finish anyway?"
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
        title="Delete this workout?"
        message="The entire workout and all of its logged sets will be deleted from your history. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          void discard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
      {confirmSetDelete ? (
        <ConfirmDialog
          visible
          title="Delete this set?"
          message={`${confirmSetDelete.exercise_name} · Set ${confirmSetDelete.set_index} will be removed from your history.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => void deleteOneSet(confirmSetDelete)}
          onCancel={() => setConfirmSetDelete(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
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
  onDelete,
}: {
  setName: string;
  exerciseName: string;
  initialWeight: number;
  initialReps: number;
  unit: string;
  onCancel: () => void;
  onConfirm: (weight: number, reps: number) => void;
  onDelete: () => void;
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
            Below target — counted as a missed set.
          </Text>
        ) : null}
        <Button label="Log set" variant="primary" onPress={() => onConfirm(weight, reps)} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
        <Button label="Delete this set" variant="danger" onPress={onDelete} />
      </View>
    </View>
  );
}
