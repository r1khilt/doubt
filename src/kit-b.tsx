// Dark-design primitives for create / check-in / results / settings / first run.
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { T, avatarColor } from "@/theme";

export function Page({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: inset.top + 12, paddingHorizontal: T.pad, paddingBottom: 32, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: T.pad, paddingBottom: inset.bottom + 16, paddingTop: 10, gap: 10 }}>{footer}</View> : null}
    </View>
  );
}

export function CloseButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Close"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
      style={({ pressed }) => [s.round, pressed && { opacity: 0.6 }]}
    >
      <View style={[s.xLine, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[s.xLine, { position: "absolute", transform: [{ rotate: "-45deg" }] }]} />
    </Pressable>
  );
}

export function TopBar({ title, small, onClose }: { title: string; small?: boolean; onClose?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={small ? s.muted13 : s.h1}>{title}</Text>
      <CloseButton onPress={onClose} />
    </View>
  );
}

export const Txt = ({ children, style, muted, size, weight, testID }: {
  children: ReactNode; style?: TextStyle | TextStyle[]; muted?: boolean; size?: number; weight?: "400" | "500" | "600"; testID?: string;
}) => (
  <Text testID={testID} style={[s.txt, muted && { color: T.muted }, size ? { fontSize: size } : null, weight ? { fontWeight: weight } : null, style as TextStyle]}>
    {children}
  </Text>
);

export const Label = ({ children }: { children: ReactNode }) => <Text style={s.muted13}>{children}</Text>;

export const Card = ({ children, style, dashed }: { children: ReactNode; style?: ViewStyle; dashed?: boolean }) => (
  <View style={[s.card, dashed && { borderStyle: "dashed", borderColor: T.muted }, style]}>{children}</View>
);

export function Chip({ label, active, onPress, accent, testID }: { label: string; active: boolean; onPress: () => void; accent?: boolean; testID?: string }) {
  const bg = active ? (accent ? T.blue : T.fg) : T.card;
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={testID ?? label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, { backgroundColor: bg, borderColor: active ? bg : T.line }, pressed && { opacity: 0.7 }]}
    >
      <Text style={{ fontSize: 14, color: active ? T.bg : T.fg, fontWeight: active ? "600" : "400" }}>{label}</Text>
    </Pressable>
  );
}

export function Btn({ title, onPress, variant = "primary", loading, disabled, testID, style }: {
  title: string; onPress: () => void; variant?: "primary" | "dark" | "outlineBlue" | "yellow"; loading?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle;
}) {
  const v = {
    primary: { bg: T.fg, fg: T.bg, border: T.fg },
    dark: { bg: T.card, fg: T.fg, border: T.line },
    outlineBlue: { bg: "transparent", fg: T.blue, border: T.blue },
    yellow: { bg: T.yellow, fg: T.bg, border: T.yellow },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={testID ?? title}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: v.bg, borderColor: v.border }, (pressed || disabled) && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={{ color: v.fg, fontSize: 16, fontWeight: "600" }}>{title}</Text>}
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

export function Avatar({ name, size = 30, ring, filled }: { name: string; size?: number; ring?: string; filled?: string }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: filled ?? avatarColor(name), borderWidth: ring ? 2 : 0, borderColor: ring,
      }}
    >
      <Text style={{ color: filled ? T.bg : T.fg, fontSize: size * 0.38, fontWeight: "600" }}>{(name[0] ?? "?").toUpperCase()}</Text>
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
  h1: { color: T.fg, fontSize: 24, fontWeight: "600", letterSpacing: -0.5 },
  muted13: { color: T.muted, fontSize: 13 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, alignItems: "center", justifyContent: "center" },
  xLine: { width: 16, height: 2, borderRadius: 1, backgroundColor: T.fg },
  card: { borderRadius: T.radius.card, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, padding: 16, gap: 14 },
  chip: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  btn: { height: 56, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, color: T.fg, paddingHorizontal: 14, fontSize: 15 },
});
