import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '@/theme';

export interface ChartPoint {
  value: number;
  label: string;
}

export function ChartLine({ data }: { data: ChartPoint[] }) {
  const { width } = useWindowDimensions();
  if (data.length === 0) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;
  const yAxisOffset = Math.max(0, Math.floor(min - span * 0.25));
  const many = data.length > 7;

  return (
    <View>
      <LineChart
        data={data}
        width={many ? Math.max(width - 48, data.length * 64) : width - 48}
        height={220}
        curved
        areaChart
        thickness={2.5}
        color={colors.accent}
        startFillColor={colors.accent}
        endFillColor="rgba(255,92,56,0.02)"
        startOpacity={0.35}
        endOpacity={0.02}
        dataPointsColor={colors.text}
        dataPointsRadius={3}
        yAxisOffset={yAxisOffset}
        noOfSections={4}
        spacing={data.length > 10 ? 44 : 60}
        initialSpacing={16}
        hideRules
        xAxisColor={colors.border}
        yAxisColor={colors.border}
        xAxisLabelTextStyle={{ color: colors.faint, fontSize: 10 }}
        yAxisTextStyle={{ color: colors.faint, fontSize: 10 }}
        scrollAnimation
      />
    </View>
  );
}
