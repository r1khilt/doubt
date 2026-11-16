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
import Svg, { Circle, Path } from "react-native-svg";
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

// "3:12 PM"
export const clock = (ts: number) => {
  const d = new Date(ts);
  const h = d.getHours();
  return `${h % 12 || 12}:${d.getMinutes().toString().padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Icon paths copied from the design (24x24, stroke).
const ICONS: Record<string, string[]> = {
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  pin: ["M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"],
  thumb: ["M7 11v9H4v-9z", "M7 11l4-8a2 2 0 0 1 3 2l-1 5h5a2 2 0 0 1 2 2.3l-1.3 6A2 2 0 0 1 16.7 20H7"],
  home: ["M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  trending: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  plus: ["M12 5v14M5 12h14"],
  trophy: ["M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z", "M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"],
  back: ["M15 6l-6 6 6 6"],
  share: ["M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7", "M16 6l-4-4-4 4", "M12 2v13"],
  flag: ["M5 21V4h11l-2 4 2 4H5"],
  up: ["M12 19V5M5 12l7-7 7 7"],
};

export function Icon({ name, size = 20, color = K.fg, width = 2 }: { name: keyof typeof ICONS | string; size?: number; color?: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {(ICONS[name] ?? []).map((d) => <Path key={d} d={d} />)}
      {name === "pin" ? <Circle cx={12} cy={9.5} r={2.5} /> : null}
    </Svg>
  );
}

export function Screen({ children, scroll = true, footer, gap = 20, top = 56, bottom = 40 }: {
  children: ReactNode; scroll?: boolean; footer?: ReactNode; gap?: number; top?: number; bottom?: number;
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: Math.max(top, insets.top + 6), paddingBottom: bottom + insets.bottom, gap };
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

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[s.card, style as ViewStyle]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function T({ children, muted, small, bold, red, size, color, weight, style, testID, numberOfLines, lh }: {
  children: ReactNode; muted?: boolean; small?: boolean; bold?: boolean; red?: boolean; size?: number; color?: string;
  weight?: TextStyle["fontWeight"]; style?: TextStyle | TextStyle[]; testID?: string; numberOfLines?: number; lh?: number;
}) {
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[
        s.text, small && s.small, muted && { color: K.muted }, bold && { fontWeight: "600" }, red && { color: K.red },
        size ? { fontSize: size, lineHeight: Math.round(size * (lh ?? 1.3)) } : null, color ? { color } : null, weight ? { fontWeight: weight } : null,
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

type Variant = "primary" | "outline" | "text" | "doubt" | "believe";
export function Button({ title, sub, onPress, variant = "primary", disabled, loading, testID, style, height, icon, radius = 14, fontSize = 15 }: {
  title: string; sub?: ReactNode; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; testID?: string;
  style?: ViewStyle; height?: number; icon?: ReactNode; radius?: number; fontSize?: number;
}) {
  const fg = variant === "primary" || variant === "doubt" ? K.bg : variant === "believe" ? K.blue : variant === "text" ? K.muted : K.fg;
  const box: ViewStyle =
    variant === "primary" ? { backgroundColor: K.fg }
    : variant === "doubt" ? { backgroundColor: K.yellow }
    : variant === "believe" ? { borderWidth: 1, borderColor: K.blue, backgroundColor: "transparent" }
    : variant === "outline" ? { borderWidth: 1, borderColor: K.line }
    : {};
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={testID ?? title}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        variant === "text" ? s.textBtn : [s.btn, { borderRadius: radius }, height ? { height } : null, box],
        (pressed || disabled) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {icon}
            <Text style={[s.btnText, { color: fg, fontSize }, variant === "text" && { fontSize: 14, fontWeight: "500" }]}>{title}</Text>
          </View>
          {typeof sub === "string" ? <Text style={{ color: fg, fontSize: 12, fontWeight: "500", marginTop: 4 }}>{sub}</Text> : sub}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, size = 44, dot }: { icon: string; onPress: () => void; label: string; size?: number; dot?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.icon, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={icon === "share" ? 18 : 20} />
      {dot ? <View style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: K.yellow }} /> : null}
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <T size={13} muted>{label}</T> : null}
      <TextInput placeholderTextColor={K.dim} accessibilityLabel={props.testID ?? label} {...props} style={[s.input, props.style]} />
    </View>
  );
}

export function ProgressBar({ value, thin, color = K.blue }: { value: number; thin?: boolean; color?: string }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <View style={[s.track, thin && { height: 3 }]}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
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
      style={[
        s.chip,
        active && { backgroundColor: color, borderColor: color, borderWidth: 1.5 },
        disabled && { borderStyle: "dashed", backgroundColor: "transparent" },
      ]}
    >
      <Text style={{ fontSize: 16, fontWeight: active ? "600" : "500", color: disabled ? "#6E6E74" : active ? K.bg : K.fg, textDecorationLine: disabled ? "line-through" : "none" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const avatarFont = (size: number) => (size <= 20 ? 9 : size <= 28 ? 11 : size <= 32 ? 12 : size <= 36 ? 13 : 20);

export function Avatar({ name, size = 32, ring, border, fill, textColor = K.fg }: { name: string; size?: number; ring?: string; border?: string; fill?: string; textColor?: string }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: fill ?? avatarColor(name), alignItems: "center", justifyContent: "center",
        borderWidth: ring || border ? 2 : 0, borderColor: ring ?? border,
      }}
    >
      <Text style={{ color: textColor, fontSize: avatarFont(size), fontWeight: "600" }}>{(name[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export function AvatarStack({ names, size = 28, ring, max = 5, border = K.card }: { names: string[]; size?: number; ring?: string; max?: number; border?: string }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {names.slice(0, max).map((n, i) => (
        <View key={`${n}${i}`} style={{ marginLeft: i ? -6 : 0 }}>
          <Avatar name={n} size={size} ring={ring} border={ring ? undefined : border} />
        </View>
      ))}
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
        <View style={[s.sheet, { paddingBottom: Math.max(34, insets.bottom + 12) }]}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: K.line, alignSelf: "center" }} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20 }} style={{ maxHeight: 680 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: K.bg, paddingHorizontal: 20 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 14 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: "600", color: K.fg, letterSpacing: -0.84 },
  text: { fontSize: 15, color: K.fg, lineHeight: 20, fontVariant: ["tabular-nums"] },
  small: { fontSize: 13, lineHeight: 18 },
  btn: { height: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  textBtn: { paddingVertical: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontWeight: "600" },
  icon: { borderWidth: 1, borderColor: K.line, backgroundColor: K.card, alignItems: "center", justifyContent: "center" },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, color: K.fg, paddingHorizontal: 14, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: K.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: K.line },
  chip: { flex: 1, height: 52, borderRadius: 12, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: K.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: K.line, paddingHorizontal: 24, paddingTop: 12, gap: 20 },
});
