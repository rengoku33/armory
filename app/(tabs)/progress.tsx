import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/store/auth';
import { fetchHistory, fetchTemplates } from '@/lib/queries';
import { e1rm, fmtWeight, trim } from '@/lib/weights';
import type { Workout, WorkoutSet } from '@/lib/types';
import { Badge, Card, Chip, Segmented } from '@/components/ui';
import { ChartLine, type ChartPoint } from '@/components/ChartLine';
import { colors, space } from '@/theme';

type Metric = 'weight' | 'e1rm' | 'volume';

interface ExerciseOption {
  key: string;
  name: string;
}

export default function Progress() {
  const { session, profile } = useAuth();
  const unit = profile?.units ?? 'kg';
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('weight');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [history, template] = await Promise.all([
        fetchHistory(session.user.id),
        fetchTemplates(session.user.id),
      ]);
      setWorkouts(history.workouts);
      setSets(history.sets);

      // Exercises available: any that were actually logged, plus template members.
      const nameMap = new Map<string, string>();
      for (const s of history.sets) {
        if (!nameMap.has(s.exercise)) nameMap.set(s.exercise, s.exercise_name);
      }
      for (const ex of [...template.A, ...template.B]) {
        if (!nameMap.has(ex.key)) nameMap.set(ex.key, ex.name);
      }
      const opts = [...nameMap.entries()].map(([key, name]) => ({ key, name }));
      setExercises(opts);
      setSelected((cur) => (cur && nameMap.has(cur) ? cur : opts[0]?.key ?? null));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const chartData: ChartPoint[] = useMemo(() => {
    if (!selected) return [];
    const doneIds = new Set(
      workouts.filter((w) => w.completed_at).map((w) => w.id)
    );
    const byWorkout = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      if (!doneIds.has(s.workout_id)) continue;
      if (s.exercise !== selected || !s.completed) continue;
      if ((s.weight ?? 0) <= 0 || (s.reps ?? 0) <= 0) continue;
      const arr = byWorkout.get(s.workout_id) ?? [];
      arr.push(s);
      byWorkout.set(s.workout_id, arr);
    }
    const rows = [...byWorkout.entries()]
      .map(([wid, rows]) => {
        const w = workouts.find((x) => x.id === wid)!;
        const topWeight = Math.max(...rows.map((r) => r.weight ?? 0));
        return {
          date: w.started_at,
          label: format(parseISO(w.started_at), 'd MMM'),
          weight: topWeight,
          e1rm: Math.round(Math.max(...rows.map((r) => e1rm(r.weight ?? 0, r.reps ?? 0))) * 10) / 10,
          volume: Math.round(rows.reduce((sum, r) => sum + (r.weight ?? 0) * (r.reps ?? 0), 0)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return rows.map((p) => ({
      label: p.label,
      value: metric === 'weight' ? p.weight : metric === 'e1rm' ? p.e1rm : p.volume,
    }));
  }, [workouts, sets, selected, metric]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1].value;
    const prev = chartData.length > 1 ? chartData[chartData.length - 2].value : null;
    const best = Math.max(...chartData.map((d) => d.value));
    const start = chartData[0].value;
    const totalDelta = start > 0 ? ((latest - start) / start) * 100 : null;
    const lastDelta = prev != null && prev > 0 ? ((latest - prev) / prev) * 100 : null;
    return { latest, best, lastDelta, totalDelta };
  }, [chartData]);

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const metricLabel =
    metric === 'weight' ? 'TOP WEIGHT' : metric === 'e1rm' ? 'BEST EST. 1RM' : 'BIGGEST DAY';
  const selectedName = exercises.find((e) => e.key === selected)?.name ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: space(5),
          paddingTop: space(16),
          gap: space(4),
          paddingBottom: space(10),
        }}
      >
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>Progress</Text>

        {exercises.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: space(8) }}>
            <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
              No data yet. Log a few sessions and your curve shows up here.
            </Text>
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {exercises.map((ex) => (
                <Chip
                  key={ex.key}
                  label={ex.name}
                  active={selected === ex.key}
                  onPress={() => setSelected(ex.key)}
                />
              ))}
            </View>

            <Segmented<Metric>
              options={[
                { value: 'weight', label: 'Top weight' },
                { value: 'e1rm', label: 'Est. 1RM' },
                { value: 'volume', label: 'Volume' },
              ]}
              value={metric}
              onChange={setMetric}
            />

            {chartData.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: space(8) }}>
                <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
                  No {selectedName.toLowerCase() || 'workout'} sessions logged yet.
                </Text>
              </Card>
            ) : (
              <>
                <Card>
                  <ChartLine data={chartData} />
                </Card>
                {stats ? (
                  <View style={{ flexDirection: 'row', gap: space(3) }}>
                    <Card style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                        CURRENT
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>
                        {trim(stats.latest)} {unit}
                      </Text>
                      {stats.totalDelta != null ? (
                        <Badge
                          label={`${stats.totalDelta >= 0 ? '+' : ''}${stats.totalDelta.toFixed(1)}% overall`}
                          tone={stats.totalDelta >= 0 ? 'success' : 'danger'}
                        />
                      ) : null}
                    </Card>
                    <Card style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                        {metricLabel}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>
                        {fmtWeight(stats.best, unit)}
                      </Text>
                      <Text style={{ color: colors.faint, fontSize: 11 }}>
                        across {chartData.length} session{chartData.length === 1 ? '' : 's'}
                      </Text>
                    </Card>
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
