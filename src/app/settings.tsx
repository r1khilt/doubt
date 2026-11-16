import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { api } from "@convex/_generated/api";
import { useMe } from "@/me";
import { T } from "@/theme";
import { errText } from "@/ui";
import { Avatar, Btn, Field, Label, Page, TopBar, Txt, s } from "@/kit-b";

export default function Settings() {
  const { deviceId, name, setName, accounts, switchAccount, addAccount } = useMe();
  const user = useQuery(api.users.me, { deviceId });
  const update = useMutation(api.users.update);
  const [draft, setDraft] = useState(name);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<"name" | "add" | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => setDraft(name), [deviceId, name]);
  useEffect(() => {
    if (user) setSandbox(user.sandbox);
  }, [user?._id, user?.sandbox]);

  const run = async (key: "name" | "add", fn: () => Promise<void>) => {
    setErr("");
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (v: boolean) => {
    setSandbox(v);
    try {
      await update({ deviceId, sandbox: v });
    } catch (e) {
      setSandbox(!v);
      setErr(errText(e));
    }
  };

  return (
    <Page gap={20}>
      <TopBar title="Settings" />

      <View style={[s.card, { padding: 16, gap: 14 }]}>
        <Field label="Your name" value={draft} onChangeText={setDraft} placeholder="Your name" testID="settings-name"
          onSubmitEditing={() => run("name", async () => { await setName(draft); setSaved(true); setTimeout(() => setSaved(false), 1500); })} />
        <Btn title={saved ? "Saved" : "Save name"} variant="dark" style={{ height: 48 }} testID="settings-save-name"
          loading={busy === "name"} disabled={!draft.trim() || draft.trim() === name}
          onPress={() => run("name", async () => { await setName(draft); setSaved(true); setTimeout(() => setSaved(false), 1500); })} />
      </View>

      <View style={{ gap: 10 }}>
        <Label>Accounts</Label>
        <View style={[s.card, { paddingHorizontal: 16, paddingVertical: 4 }]}>
          {accounts.map((a, i) => {
            const current = a.deviceId === deviceId;
            return (
              <Pressable key={a.deviceId} accessibilityLabel={`account-${a.name}`} onPress={() => switchAccount(a.deviceId)} disabled={current}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: T.line, opacity: pressed ? 0.6 : 1 })}>
                <Avatar name={a.name} size={32} fontSize={12} bg={current ? T.blue : undefined} color={current ? T.bg : T.fg} />
                <Txt size={15} weight={current ? "600" : "400"} style={{ flex: 1 }}>{a.name}</Txt>
                <Txt size={13} weight="500" style={{ color: current ? T.blue : T.muted }}>{current ? "Current" : "Switch"}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Field value={newName} onChangeText={setNewName} placeholder="New account name" testID="add-account-name"
              onSubmitEditing={() => run("add", async () => { await addAccount(newName); setNewName(""); })} />
          </View>
          <Btn title="Add account" variant="dark" style={{ height: 48, paddingHorizontal: 16, borderRadius: 12 }} testID="add-account"
            loading={busy === "add"} disabled={!newName.trim()}
            onPress={() => run("add", async () => { await addAccount(newName); setNewName(""); })} />
        </View>
      </View>

      <View style={[s.card, { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={15} weight="500">Sandbox mode</Txt>
          <Txt muted size={12}>Payments in new challenges you create settle instantly in-app.</Txt>
        </View>
        <Switch testID="sandbox-toggle" accessibilityLabel="sandbox-toggle" value={sandbox} onValueChange={toggle} disabled={user === undefined}
          trackColor={{ false: T.line, true: T.blue }} thumbColor={T.fg} ios_backgroundColor={T.line} />
      </View>

      {err ? <Txt size={13} style={{ color: T.red }}>{err}</Txt> : null}
    </Page>
  );
}
