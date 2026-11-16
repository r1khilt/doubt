// Primitives matching the "Doubters App Design" templates (390pt frame, 56 top, 34 bottom).
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { router } from "expo-router";
import { T, avatarColor } from "@/theme";

const em = (size: number, e: number) => size * e;

export function Page({ children, footer, gap = 18 }: { children: ReactNode; footer?: ReactNode; gap?: number }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: Math.max(56, inset.top + 9), paddingHorizontal: 20, paddingBottom: 24, gap }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(34, inset.bottom + 8), paddingTop: 8, gap: 10 }}>{footer}</View> : null}
    </View>
  );
}

// ── Icons (paths copied from the templates, 24×24 viewBox, stroke 2, round caps) ──
type IconProps = { size?: number; color?: string };
const icon = (paths: ReactNode, join = false) => ({ size = 18, color = T.fg }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin={join ? "round" : undefined}>
    {paths}
  </Svg>
);
export const IconX = icon(<Path d="M6 6l12 12M18 6L6 18" />);
export const IconMinus = icon(<Path d="M5 12h14" />);
export const IconPlus = icon(<Path d="M12 5v14M5 12h14" />);
export const IconPin = icon(<><Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><Circle cx="12" cy="9.5" r="2.5" /></>, true);
export const IconChevron = icon(<Path d="M9 6l6 6-6 6" />, true);
export const IconVideo = icon(<><Path d="M16 13l5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><Rect x="2" y="6" width="14" height="12" rx="2" /></>, true);

export function RoundButton({ children, onPress, label, transparent }: { children: ReactNode; onPress: () => void; label: string; transparent?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.round, transparent && { backgroundColor: "transparent" }, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

export const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

export function TopBar({ title, small, onClose }: { title: string; small?: boolean; onClose?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={small ? s.muted13 : s.h1}>{title}</Text>
      <RoundButton label="Close" onPress={onClose ?? close}><IconX /></RoundButton>
    </View>
  );
}

export const Txt = ({ children, style, muted, size, weight, ls, testID, numberOfLines }: {
  children: ReactNode; style?: TextStyle | TextStyle[]; muted?: boolean; size?: number; weight?: "400" | "500" | "600"; ls?: number; testID?: string; numberOfLines?: number;
}) => (
  <Text testID={testID} numberOfLines={numberOfLines}
    style={[s.txt, muted && { color: T.muted }, size ? { fontSize: size } : null, weight ? { fontWeight: weight } : null, ls !== undefined && size ? { letterSpacing: em(size, ls) } : null, style as TextStyle]}>
    {children}
  </Text>
);

export const Label = ({ children }: { children: ReactNode }) => <Text style={s.muted13}>{children}</Text>;

export function Btn({ title, onPress, variant = "primary", loading, disabled, testID, style }: {
  title: string; onPress: () => void; variant?: "primary" | "dark" | "outlineBlue"; loading?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle;
}) {
  const v = {
    primary: { bg: T.fg, fg: T.bg, border: T.fg, size: 16 },
    dark: { bg: T.card, fg: T.fg, border: T.line, size: 15 },
    outlineBlue: { bg: "transparent", fg: T.blue, border: T.blue, size: 15 },
  }[variant];
  return (
    <Pressable testID={testID} accessibilityLabel={testID ?? title} accessibilityRole="button" onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: v.bg, borderColor: v.border }, (pressed || disabled) && { opacity: 0.5 }, style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={{ color: v.fg, fontSize: v.size, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor={T.dim} accessibilityLabel={props.testID} {...props} style={[s.input, props.style]} />
    </View>
  );
}

export function Avatar({ name, size = 30, ring, ringWidth = 2, bg, color, fontSize }: {
  name: string; size?: number; ring?: string; ringWidth?: number; bg?: string; color?: string; fontSize?: number;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: bg ?? avatarColor(name), borderWidth: ring ? ringWidth : 0, borderColor: ring }}>
      <Text style={{ color: color ?? T.fg, fontSize: fontSize ?? 11, fontWeight: "600" }}>{(name[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export const AvatarStack = ({ names, ring, size = 28 }: { names: string[]; ring?: string; size?: number }) => (
  <View style={{ flexDirection: "row" }}>
    {names.slice(0, 5).map((n, i) => (
      <View key={n + i} style={{ marginLeft: i ? -6 : 0 }}>
        <Avatar name={n} size={size} ring={ring} />
      </View>
    ))}
  </View>
);

export const s = StyleSheet.create({
  txt: { color: T.fg, fontSize: 15, fontVariant: ["tabular-nums"] },
  h1: { color: T.fg, fontSize: 24, fontWeight: "600", letterSpacing: -0.48 },
  muted13: { color: T.muted, fontSize: 13 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 16, borderWidth: 1, borderColor: T.line, backgroundColor: T.card },
  btn: { height: 56, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, color: T.fg, paddingHorizontal: 14, fontSize: 15 },
});
