import React from 'react';
import { Modal, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { PLATE_COLORS, platesPerSide } from '@/lib/plates';
import { BAR_WEIGHT, trim } from '@/lib/weights';
import { Button } from './ui';
import type { Unit } from '@/lib/types';

export function PlateCalculatorModal({
  visible,
  weight,
  unit,
  onClose,
}: {
  visible: boolean;
  weight: number | null;
  unit: Unit;
  onClose: () => void;
}) {
  const b = weight != null ? platesPerSide(weight, unit) : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(4,6,10,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space(6),
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: space(5),
            gap: space(3),
            width: '100%',
            maxWidth: 360,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>
            PLATES PER SIDE
          </Text>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>
            {weight != null ? `${trim(weight)} ${unit}` : '—'}
          </Text>
          {b && b.perSide > 0 ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>
                {b.plates.map((p) => (
                  <View
                    key={p.plate}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radius.pill,
                      paddingLeft: 4,
                      paddingRight: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        backgroundColor: PLATE_COLORS[String(p.plate)] ?? colors.faint,
                        borderWidth: p.plate === 5 ? 1 : 0,
                        borderColor: colors.border,
                      }}
                    />
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                      {trim(p.plate)}
                      {p.count > 1 ? ` ×${p.count}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
              {b.leftover > 0.001 ? (
                <Text style={{ color: colors.warn, fontSize: 12 }}>
                  No plate for the last {trim(b.leftover)} {unit} per side
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: colors.muted }}>Just the bar.</Text>
          )}
          <Text style={{ color: colors.faint, fontSize: 12 }}>
            Bar: {trim(BAR_WEIGHT[unit])} {unit}
          </Text>
          <Button label="Done" onPress={onClose} variant="ghost" />
        </View>
      </View>
    </Modal>
  );
}
