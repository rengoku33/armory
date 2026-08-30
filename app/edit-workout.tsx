import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/auth';
import {
  addExerciseToTemplate,
  createCustomExercise,
  fetchTemplates,
  removeTemplateExercise,
  reorderTemplateExercise,
  updateTemplateExercise,
} from '@/lib/queries';
import { EXERCISES, LIFT_ORDER } from '@/lib/exercises';
import type { WorkoutDay, WorkoutExercise, WorkoutTemplate } from '@/lib/types';
import { Badge, Button, Chip, Field } from '@/components/ui';
import { colors, radius, space } from '@/theme';

export default function EditWorkout() {
  const router = useRouter();
  const { session, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [day, setDay] = useState<WorkoutDay>('A');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setTemplate(await fetchTemplates(session.user.id));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const list = day === 'A' ? template?.A ?? [] : template?.B ?? [];

  const move = async (idx: number, dir: -1 | 1) => {
    if (!session || !template) return;
    const arr = [...list];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    const [item] = arr.splice(idx, 1);
    arr.splice(target, 0, item);
    setTemplate(day === 'A' ? { ...template, A: arr } : { ...template, B: arr });
    // persist both swapped sort orders
    await Promise.all([
      reorderTemplateExercise(session.user.id, day, item.key, target),
      reorderTemplateExercise(session.user.id, day, arr[target + (dir > 0 ? -1 : 1)].key, idx),
    ]);
    void Haptics.selectionAsync().catch(() => {});
  };

  const remove = async (ex: WorkoutExercise) => {
    if (!session || !template) return;
    const arr = list.filter((e) => e.key !== ex.key);
    setTemplate(day === 'A' ? { ...template, A: arr } : { ...template, B: arr });
    await removeTemplateExercise(session.user.id, day, ex.key);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const setSetsReps = async (ex: WorkoutExercise, patch: Partial<Pick<WorkoutExercise, 'sets' | 'reps'>>) => {
    if (!session || !template) return;
    const arr = list.map((e) => (e.key === ex.key ? { ...e, ...patch } : e));
    setTemplate(day === 'A' ? { ...template, A: arr } : { ...template, B: arr });
    await updateTemplateExercise(session.user.id, day, ex.key, patch);
  };

  const onAdded = () => {
    setAdding(false);
    void load();
  };

  if (loading || !template || !session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const usedKeys = new Set(list.map((e) => e.key));
  const availableBuiltIns = LIFT_ORDER.filter((k) => !usedKeys.has(k));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ paddingTop: space(14), paddingHorizontal: space(5), gap: space(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Pressable hitSlop={8} onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', flex: 1 }}>
            Edit workout
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(2) }}>
          {(['A', 'B'] as WorkoutDay[]).map((d) => (
            <Chip key={d} label={`Workout ${d}`} active={day === d} onPress={() => setDay(d)} />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space(5), gap: space(3), paddingBottom: space(12) }}
        keyboardShouldPersistTaps="handled"
      >
        {list.map((ex, idx) => (
          <View
            key={ex.key}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: space(3),
              gap: space(2),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{ex.name}</Text>
                {ex.isCustom ? <Badge label="CUSTOM" tone="accent" /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <IconBtn icon="arrow-up" disabled={idx === 0} onPress={() => void move(idx, -1)} />
                <IconBtn
                  icon="arrow-down"
                  disabled={idx === list.length - 1}
                  onPress={() => void move(idx, 1)}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => void remove(ex)}
                  style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
              <MiniStepper
                label="SETS"
                value={ex.sets}
                min={1}
                onChange={(v) => void setSetsReps(ex, { sets: v })}
              />
              <MiniStepper
                label="REPS"
                value={ex.reps}
                min={1}
                onChange={(v) => void setSetsReps(ex, { reps: v })}
              />
            </View>
          </View>
        ))}

        {list.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: space(6) }}>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              No exercises in Workout {day} yet. Add some below.
            </Text>
          </View>
        ) : null}

        {availableBuiltIns.length > 0 && !adding ? (
          <View style={{ gap: space(2) }}>
            <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
              ADD A BUILT-IN
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {availableBuiltIns.map((k) => (
                <Chip
                  key={k}
                  label={EXERCISES[k].name}
                  onPress={() =>
                    void addExerciseToTemplate(session.user.id, day, {
                      key: k,
                      name: EXERCISES[k].name,
                      isCustom: false,
                      sets: EXERCISES[k].sets,
                      reps: EXERCISES[k].reps,
                    }).then(onAdded)
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        <Button
          label="Add a custom exercise"
          variant={adding ? 'ghost' : 'primary'}
          onPress={() => setAdding(!adding)}
        />

        {adding ? (
          <AddCustomForm
            unit={profile?.units ?? 'kg'}
            onCancel={() => setAdding(false)}
            onSave={async (name, sets, reps) => {
              const key = await createCustomExercise(session.user.id, name);
              await addExerciseToTemplate(session.user.id, day, {
                key,
                name: name.trim(),
                isCustom: true,
                sets,
                reps,
              });
              onAdded();
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function IconBtn({
  icon,
  onPress,
  disabled,
}: {
  icon: 'arrow-up' | 'arrow-down';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
        padding: 4,
      })}
    >
      <Ionicons name={icon as never} size={20} color={colors.muted} />
    </Pressable>
  );
}

function MiniStepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  const pressableStyle = ({ pressed }: { pressed: boolean }): ViewStyle => ({
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: pressed ? 0.6 : 1,
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', width: 36 }}>{label}</Text>
      <Pressable hitSlop={6} onPress={() => onChange(Math.max(min, value - 1))} style={pressableStyle}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>−</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' }}>
        {value}
      </Text>
      <Pressable hitSlop={6} onPress={() => onChange(Math.max(min, value + 1))} style={pressableStyle}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>+</Text>
      </Pressable>
    </View>
  );
}

function AddCustomForm({
  unit,
  onCancel,
  onSave,
}: {
  unit: string;
  onCancel: () => void;
  onSave: (name: string, sets: number, reps: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('Give the exercise a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(name, sets, reps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: space(4),
        gap: space(3),
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>New custom exercise</Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Chest Press Machine" />
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <MiniStepper label="SETS" value={sets} min={1} onChange={setSets} />
        <MiniStepper label="REPS" value={reps} min={1} onChange={setReps} />
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Add to Workout" loading={busy} onPress={() => void save()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
