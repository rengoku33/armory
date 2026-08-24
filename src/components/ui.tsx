import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, space } from '@/theme';

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: colors.text, fontSize: 18, fontWeight: '700' }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: colors.muted, fontSize: 14 }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: space(4),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const palette = {
    primary: { bg: colors.accent, fg: '#FFFFFF' },
    success: { bg: colors.success, fg: '#06281A' },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: colors.surfaceAlt, fg: colors.text },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderRadius: radius.md,
          paddingVertical: space(3.5),
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          minHeight: 50,
          flexDirection: 'row',
          gap: space(2),
        },
        variant === 'ghost' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? colors.accentSoft : colors.surfaceAlt,
        borderColor: active ? colors.accent : colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        paddingHorizontal: space(3),
        paddingVertical: space(1.5),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: active ? colors.accent : colors.muted,
          fontWeight: '700',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          onPress={() => onChange(o.value)}
          style={{
            flex: 1,
            backgroundColor: value === o.value ? colors.accent : 'transparent',
            borderRadius: radius.sm + 2,
            paddingVertical: space(1.5),
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: value === o.value ? '#FFFFFF' : colors.muted,
              fontWeight: '700',
              fontSize: 13,
            }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function StepButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  step = 2.5,
  min = 0,
  max = 100000,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, parseFloat(v.toFixed(2))));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <StepButton label="−" onPress={() => onChange(clamp(value - step))} />
      <View style={{ minWidth: 84, alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          {parseFloat(value.toFixed(2))}
          {suffix ? ` ${suffix}` : ''}
        </Text>
      </View>
      <StepButton label="+" onPress={() => onChange(clamp(value + step))} />
    </View>
  );
}

export function Field({
  label,
  ...inputProps
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space(1) }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        keyboardAppearance="dark"
        {...inputProps}
        style={[
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            color: colors.text,
            paddingHorizontal: space(3),
            paddingVertical: space(3),
            fontSize: 15,
          },
          inputProps.style,
        ]}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
}) {
  const map = {
    neutral: { bg: colors.surfaceAlt, fg: colors.muted },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    success: { bg: colors.successSoft, fg: colors.success },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderRadius: radius.pill,
        paddingHorizontal: space(2),
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
        {label}
      </Text>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
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
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            padding: space(5),
            gap: space(3),
            width: '100%',
            maxWidth: 360,
          }}
        >
          <Heading>{title}</Heading>
          {message ? <Body>{message}</Body> : null}
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Button label={cancelLabel} onPress={onCancel} variant="ghost" style={{ flex: 1 }} />
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              variant="primary"
              style={danger ? { backgroundColor: colors.danger } : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
