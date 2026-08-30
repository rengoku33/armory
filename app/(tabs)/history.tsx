import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/store/auth';
import { fetchHistory } from '@/lib/queries';
import { trim } from '@/lib/weights';
import type { Workout, WorkoutSet } from '@/lib/types';
import { Badge } from '@/components/ui';
import { colors, radius, space } from '@/theme';

interface HistoryItem {
  workout: Workout;
  sets: WorkoutSet[];
}

export default function History() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const unit = profile?.units ?? 'kg';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const { workouts, sets } = await fetchHistory(session.user.id);
      const byId = new Map<string, WorkoutSet[]>();
      for (const s of sets) {
        const arr = byId.get(s.workout_id) ?? [];
        arr.push(s);
        byId.set(s.workout_id, arr);
      }
      setItems(workouts.map((w) => ({ workout: w, sets: byId.get(w.id) ?? [] })));
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const sections: { label: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const label = format(parseISO(item.workout.started_at), 'MMMM yyyy');
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(item);
    else sections.push({ label, items: [item] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: space(5), paddingTop: space(16), gap: space(3), paddingBottom: space(10) }}
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
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>History</Text>

        {items.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: space(2) }}>
            No workouts yet. Your first session is waiting on the Today tab.
          </Text>
        ) : null}

        {sections.map((section) => (
          <View key={section.label} style={{ gap: space(2.5) }}>
            <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: space(2) }}>
              {section.label.toUpperCase()}
            </Text>
            {section.items.map(({ workout, sets }) => {
              const done = sets.filter((s) => s.completed);
              const ratio = `${done.length}/${sets.length}`;
              const full = done.length === sets.length && sets.length > 0;
              const exChips = new Map<string, { name: string; weight: number }>();
              for (const s of done) {
                const w = s.weight ?? s.target_weight;
                const prev = exChips.get(s.exercise);
                if (!prev || w > prev.weight) {
                  exChips.set(s.exercise, { name: s.exercise_name, weight: w });
                }
              }
              return (
                <Pressable
                  key={workout.id}
                  onPress={() => router.push(`/workout/${workout.id}`)}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    padding: space(4),
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space(3),
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: radius.md,
                      backgroundColor: workout.completed_at ? colors.accentSoft : colors.warnSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: workout.completed_at ? colors.accent : colors.warn,
                        fontSize: 20,
                        fontWeight: '900',
                      }}
                    >
                      {workout.day}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: space(1) }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                      {format(parseISO(workout.started_at), 'EEE d MMM')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: 2 }}>
                      {[...exChips.entries()].map(([key, c]) => (
                        <View
                          key={key}
                          style={{
                            backgroundColor: colors.surfaceAlt,
                            borderRadius: radius.pill,
                            paddingHorizontal: space(1.5),
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>
                            {c.name.slice(0, 3).toUpperCase()} {trim(c.weight)}{unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: space(1) }}>
                    {!workout.completed_at ? (
                      <Badge label="IN PROGRESS" tone="warn" />
                    ) : (
                      <Badge label={ratio} tone={full ? 'success' : 'warn'} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
