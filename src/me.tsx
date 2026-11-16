import { useMutation } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import { api } from "@convex/_generated/api";
import { T } from "@/theme";
import { Btn, Field, Txt } from "@/kit-b";

export type Account = { deviceId: string; name: string };
type Me = {
  deviceId: string; // active account — key the app tree on this to re-render as that person
  name: string;
  accounts: Account[];
  setName: (name: string) => Promise<void>;
  switchAccount: (deviceId: string) => Promise<void>;
  addAccount: (name: string) => Promise<void>;
};
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
const save = (accounts: Account[], activeId: string) =>
  Promise.all([store.set("accounts", JSON.stringify(accounts)), store.set("activeId", activeId)]).catch(() => {});

export function MeProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [firstRunId, setFirstRunId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const ensure = useMutation(api.users.ensure);

  useEffect(() => {
    (async () => {
      let list: Account[] = [];
      try { list = JSON.parse((await store.get("accounts").catch(() => null)) ?? "[]"); } catch {}
      let active = await store.get("activeId").catch(() => null);
      if (!list.length) {
        // Migrate the single-account storage from earlier builds.
        const legacyId = await store.get("deviceId").catch(() => null);
        const legacyName = await store.get("name").catch(() => null);
        if (legacyId && legacyName) {
          list = [{ deviceId: legacyId, name: legacyName }];
          active = legacyId;
          await save(list, legacyId);
        } else setFirstRunId(legacyId ?? randomId());
      }
      const current = list.find((a) => a.deviceId === active) ?? list[0];
      if (current) ensure(current).catch(() => {});
      setAccounts(list);
      setActiveId(current?.deviceId ?? null);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: "center" }}>
        <ActivityIndicator color={T.fg} />
      </View>
    );
  }

  const addAccount = async (raw: string, id = randomId()) => {
    const name = raw.trim();
    if (!name) return;
    await ensure({ deviceId: id, name });
    const list = [...accounts, { deviceId: id, name }];
    setAccounts(list);
    setActiveId(id);
    await save(list, id);
  };

  const active = accounts.find((a) => a.deviceId === activeId);

  if (!active) {
    const create = async () => {
      if (!draft.trim()) return;
      setSaving(true);
      try {
        await addAccount(draft, firstRunId || randomId());
      } finally {
        setSaving(false);
      }
    };
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, gap: 32 }}>
          <View style={{ gap: 10 }}>
            <Txt size={17} weight="600" ls={-0.02}>doubt</Txt>
            <Txt size={34} weight="600" ls={-0.03} style={{ lineHeight: 38 }}>Prove them wrong.{"\n"}Get paid.</Txt>
            <Txt muted>Stake money on your goal. Friends bet you'll quit.</Txt>
          </View>
          <Field label="Your name" value={draft} onChangeText={setDraft} placeholder="Alex" autoFocus testID="name-input" onSubmitEditing={create} returnKeyType="done" />
          <Btn title="Continue" onPress={create} loading={saving} disabled={!draft.trim()} testID="name-submit" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  const setName = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    await ensure({ deviceId: active.deviceId, name });
    const list = accounts.map((a) => (a.deviceId === active.deviceId ? { ...a, name } : a));
    setAccounts(list);
    await save(list, active.deviceId);
  };

  const switchAccount = async (id: string) => {
    const next = accounts.find((a) => a.deviceId === id);
    if (!next || id === active.deviceId) return;
    setActiveId(id);
    await save(accounts, id);
    ensure(next).catch(() => {});
  };

  return (
    <MeContext.Provider value={{ deviceId: active.deviceId, name: active.name, accounts, setName, switchAccount, addAccount: (n) => addAccount(n) }}>
      {children}
    </MeContext.Provider>
  );
}
