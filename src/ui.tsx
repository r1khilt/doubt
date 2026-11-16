import { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T as K, avatarColor } from "@/theme";

// Legacy color names kept for screens that still import `C`.
export const C = { bg: K.bg, fg: K.fg, muted: K.muted, line: K.line, track: K.line, red: K.red, card: K.card, blue: K.blue, yellow: K.yellow };

export const money = (cents: number) => {
  const d = cents / 100;
  return "$" + (Number.isInteger(d) ? d.toString() : d.toFixed(2));
};

export const errText = (e: any): string =>
  typeof e?.data === "string" ? e.data : (e?.message ?? "Something went wrong").replace(/^.*Uncaught (ConvexError|Error): /s, "").split("\n")[0];

export const timeLeft = (endsAt: number, now: number) => {
  const s = Math.max(0, Math.floor((endsAt - now) / 1000));
  if (s === 0) return "Ended";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}:${sec.toString().padStart(2, "0")} left`;
};

export const ago = (ts: number, now: number) => {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export function Screen({ children, scroll = true, footer }: { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 };
  return (
    <View style={{ flex: 1, backgroundColor: K.bg }}>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.screen, pad]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.screen, pad, { flex: 1 }]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function T({ children, muted, small, bold, red, size, color, weight, style, testID, numberOfLines }: {
  children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; red?: boolean; size?: number; color?: string;
  weight?: TextStyle["fontWeight"]; style?: TextStyle | TextStyle[]; testID?: string; numberOfLines?: number;
}) {
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[
        s.text, small && s.small, muted && { color: K.muted }, bold && { fontWeight: "600" }, red && { color: K.red },
        size ? { fontSize: size, lineHeight: Math.round(size * 1.3) } : null, color ? { color } : null, weight ? { fontWeight: weight } : null,
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

type Variant = "primary" | "outline" | "text" | "doubt" | "believe";
export function Button({ title, sub, onPress, variant = "primary", disabled, loading, testID, style, height }: {
  title: string; sub?: ReactNode; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; testID?: string; style?: ViewStyle; height?: number;
}) {
  const fg = variant === "primary" || variant === "doubt" ? K.bg : variant === "believe" ? K.blue : variant === "text" ? K.muted : K.fg;
  const box: ViewStyle =
    variant === "primary" ? { backgroundColor: K.fg }
    : variant === "doubt" ? { backgroundColor: K.yellow }
    : variant === "believe" ? { borderWidth: 1, borderColor: K.blue, backgroundColor: K.card }
    : variant === "outline" ? { borderWidth: 1, borderColor: K.line, backgroundColor: K.card }
    : {};
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={testID ?? title}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        variant === "text" ? s.textBtn : [s.btn, height ? { height } : null, box],
        (pressed || disabled) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[s.btnText, { color: fg }, variant === "text" && { fontSize: 14, fontWeight: "500" }]}>{title}</Text>
          {typeof sub === "string" ? <Text style={{ color: fg, fontSize: 12, fontWeight: "500", marginTop: 2 }}>{sub}</Text> : sub}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ glyph, onPress, label, size = 44 }: { glyph: string; onPress: () => void; label: string; size?: number }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.icon, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.5 }]}
    >
      <Text style={{ color: K.fg, fontSize: 18, fontWeight: "500", marginTop: -1 }}>{glyph}</Text>
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <T small muted>{label}</T> : null}
      <TextInput placeholderTextColor={K.dim} accessibilityLabel={props.testID ?? label} {...props} style={[s.input, props.style]} />
    </View>
  );
}

export function ProgressBar({ value, thin, color = K.blue }: { value: number; thin?: boolean; color?: string }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <View style={[s.track, thin && { height: 3 }]}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export const Divider = () => <View style={s.divider} />;

export function Chip({ label, active, onPress, disabled, color = K.fg }: { label: string; active: boolean; onPress: () => void; disabled?: boolean; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[s.chip, active && { backgroundColor: color, borderColor: color }, disabled && { borderStyle: "dashed", backgroundColor: "transparent" }]}
    >
      <Text style={{ fontSize: 16, fontWeight: active ? "600" : "500", color: disabled ? K.dim : active ? K.bg : K.fg, textDecorationLine: disabled ? "line-through" : "none" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 32, ring, border }: { name: string; size?: number; ring?: string; border?: string }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name), alignItems: "center", justifyContent: "center",
        borderWidth: ring || border ? 2 : 0, borderColor: ring ?? border,
      }}
    >
      <Text style={{ color: K.fg, fontSize: Math.round(size * 0.4), fontWeight: "600" }}>{(name[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export function AvatarStack({ names, size = 28, ring, max = 5 }: { names: string[]; size?: number; ring?: string; max?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {names.slice(0, max).map((n, i) => (
        <View key={`${n}${i}`} style={{ marginLeft: i ? -6 : 0 }}>
          <Avatar name={n} size={size} ring={ring} border={ring ? undefined : K.card} />
        </View>
      ))}
      {names.length > max ? (
        <View style={{ marginLeft: -6, width: size, height: size, borderRadius: size / 2, backgroundColor: K.line, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: K.fg, fontSize: 10, fontWeight: "600" }}>+{names.length - max}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} />
        </Pressable>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: K.line, alignSelf: "center" }} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20 }} style={{ maxHeight: 640 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: K.bg, paddingHorizontal: K.pad, gap: 20 },
  card: { borderRadius: K.radius.card, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 14 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: "600", color: K.fg, letterSpacing: -0.8 },
  text: { fontSize: 15, color: K.fg, lineHeight: 20, fontVariant: ["tabular-nums"] },
  small: { fontSize: 13, lineHeight: 18 },
  btn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  textBtn: { paddingVertical: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontWeight: "600" },
  icon: { borderWidth: 1, borderColor: K.line, backgroundColor: K.card, alignItems: "center", justifyContent: "center" },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, color: K.fg, paddingHorizontal: 14, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: K.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: K.line },
  chip: { flex: 1, height: 52, borderRadius: 12, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: K.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: K.line, paddingHorizontal: 24, paddingTop: 12, gap: 20 },
});
