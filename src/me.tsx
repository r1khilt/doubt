import { useMutation } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import { api } from "@convex/_generated/api";
import { T } from "@/theme";
import { Btn, Field, Txt } from "@/kit-b";

type Me = { deviceId: string; name: string; setName: (name: string) => Promise<void> };
const MeContext = createContext<Me | null>(null);

export const useMe = () => {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside MeProvider");
  return me;
};

// SecureStore is native-only; the web build uses localStorage.
export const store = Platform.OS === "web"
  ? { get: async (k: string) => localStorage.getItem(k), set: async (k: string, v: string) => localStorage.setItem(k, v) }
  : { get: SecureStore.getItemAsync, set: (k: string, v: string) => SecureStore.setItemAsync(k, v) };

const randomId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<{ deviceId: string; name: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const ensure = useMutation(api.users.ensure);

  useEffect(() => {
    (async () => {
      let deviceId = await store.get("deviceId").catch(() => null);
      if (!deviceId) {
        deviceId = randomId();
        await store.set("deviceId", deviceId).catch(() => {});
      }
      const name = await store.get("name").catch(() => null);
      if (name) {
        setMe({ deviceId, name });
        ensure({ deviceId, name }).catch(() => {});
      } else setMe({ deviceId, name: "" });
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !me) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: "center" }}>
        <ActivityIndicator color={T.fg} />
      </View>
    );
  }

  // Saves the name locally and on the server (used by first run and Settings).
  const setName = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    await ensure({ deviceId: me.deviceId, name });
    await store.set("name", name).catch(() => {});
    setMe({ ...me, name });
  };

  if (!me.name) {
    const save = async () => {
      if (!draft.trim()) return;
      setSaving(true);
      try {
        await setName(draft);
      } finally {
        setSaving(false);
      }
    };
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: T.pad, gap: 32 }}>
          <View style={{ gap: 10 }}>
            <Txt size={17} weight="600" style={{ letterSpacing: -0.3 }}>doubt</Txt>
            <Txt size={34} weight="600" style={{ letterSpacing: -1, lineHeight: 38 }}>Prove them wrong.{"\n"}Get paid.</Txt>
            <Txt muted>Stake money on your goal. Friends bet you'll quit.</Txt>
          </View>
          <Field label="Your name" value={draft} onChangeText={setDraft} placeholder="Alex" autoFocus testID="name-input" onSubmitEditing={save} returnKeyType="done" />
          <Btn title="Continue" onPress={save} loading={saving} disabled={!draft.trim()} testID="name-submit" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return <MeContext.Provider value={{ ...me, setName }}>{children}</MeContext.Provider>;
}
