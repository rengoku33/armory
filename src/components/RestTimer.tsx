import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, radius, space } from '@/theme';
import { fmtDuration } from '@/lib/weights';

const SIZE = 56;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function RestTimer({
  seconds,
  onDone,
  onSkip,
}: {
  seconds: number;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [total, setTotal] = useState(seconds);
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          if (!firedRef.current) {
            firedRef.current = true;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onDoneRef.current();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = total > 0 ? remaining / total : 0;
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: space(3),
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
      }}
    >
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{fmtDuration(remaining)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Rest</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Next set in {fmtDuration(remaining)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setTotal((t) => t + 15);
          setRemaining((r) => r + 15);
        }}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.sm,
          paddingHorizontal: space(2.5),
          paddingVertical: space(1.5),
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12 }}>+15s</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          onSkip();
        }}
        style={({ pressed }) => ({
          backgroundColor: colors.accentSoft,
          borderRadius: radius.sm,
          paddingHorizontal: space(3),
          paddingVertical: space(1.5),
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>SKIP</Text>
      </Pressable>
    </View>
  );
}
