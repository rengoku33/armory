import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/store/auth';
import { fetchHistory } from '@/lib/queries';
import { EXERCISES } from '@/lib/exercises';
import { e1rm, fmtWeight, trim } from '@/lib/weights';
import type { LiftId, Workout, WorkoutSet } from '@/lib/types';
import { Badge, Card, Chip, Segmented } from '@/components/ui';
import { ChartLine, type ChartPoint } from '@/components/ChartLine';
import { colors, space } from '@/theme';

type Metric = 'weight' | 'e1rm' | 'volume';

export default function Progress() {
  const { session, profile } = useAuth();
  const unit = profile?.units ?? 'kg';
  const [loading, setLoading] = useState(true);
  const [lift, setLift] = useState<LiftId>('squat');
  const [metric, setMetric] = useState<Metric>('weight');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const history = await fetchHistory(session.user.id);
      setWorkouts(history.workouts);
      setSets(history.sets);
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
    const doneIds = new Set(
      workouts.filter((w) => w.completed_at).map((w) => w.id)
    );
    const byWorkout = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      if (!doneIds.has(s.workout_id)) continue;
      if (s.exercise !== lift || !s.completed) continue;
      if ((s.weight ?? 0) <= 0 || (s.reps ?? 0) <= 0) continue;
      const arr = byWorkout.get(s.workout_id) ?? [];
      arr.push(s);
      byWorkout.set(s.workout_id, arr);
    }
    const points = [...byWorkout.entries()]
      .map(([wid, rows]) => {
        const w = workouts.find((x) => x.id === wid)!;
        return {
          date: w.started_at,
          label: format(parseISO(w.started_at), 'd MMM'),
          weight: Math.max(...rows.map((r) => r.weight ?? r.target_weight)),
          e1rm: Math.round(Math.max(...rows.map((r) => e1rm(r.weight ?? 0, r.reps ?? 0))) * 10) / 10,
          volume: Math.round(rows.reduce((sum, r) => sum + (r.weight ?? 0) * (r.reps ?? 0), 0)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        label: p.label,
        value:
          metric === 'weight'
            ? p.weight
            : metric === 'e1rm'
              ? p.e1rm
              : p.volume,
      }));
    return points.slice(-24);
  }, [workouts, sets, lift, metric]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1].value;
    const prev = chartData.length > 1 ? chartData[chartData.length - 2].value : null;
    const best = Math.max(...chartData.map((d) => d.value));
    const delta = prev != null && prev > 0 ? ((latest - prev) / prev) * 100 : null;
    return { latest, best, delta };
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

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {(Object.keys(EXERCISES) as LiftId[]).map((l) => (
            <Chip
              key={l}
              label={EXERCISES[l].name.replace('Barbell ', '')}
              active={lift === l}
              onPress={() => setLift(l)}
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
              No data yet.{'\n'}Log a few {EXERCISES[lift].name.toLowerCase()} sessions and your
              curve shows up here.
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
                  {stats.delta != null ? (
                    <Badge
                      label={`${stats.delta >= 0 ? '+' : ''}${stats.delta.toFixed(1)}%`}
                      tone={stats.delta >= 0 ? 'success' : 'danger'}
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
      </ScrollView>
    </View>
  );
}
