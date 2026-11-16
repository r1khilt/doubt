import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { api } from "@convex/_generated/api";
import { useMe } from "@/me";
import { T } from "@/theme";
import { errText } from "@/ui";
import { Btn, Card, Field, Page, TopBar, Txt } from "@/kit-b";

export default function Settings() {
  const { deviceId, name, setName } = useMe();
  const user = useQuery(api.users.me, { deviceId });
  const update = useMutation(api.users.update);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    if (user) setSandbox(user.sandbox);
  }, [user?.sandbox]);

  const saveName = async () => {
    setErr("");
    setSaving(true);
    try {
      await setName(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setSaving(false);
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
    <Page>
      <TopBar title="Settings" />

      <Card>
        <Field label="Display name" value={draft} onChangeText={setDraft} placeholder="Your name" testID="settings-name" onSubmitEditing={saveName} />
        <Btn
          title={saved ? "Saved" : "Save name"}
          variant="dark"
          onPress={saveName}
          loading={saving}
          disabled={!draft.trim() || draft.trim() === name}
          testID="settings-save-name"
          style={{ height: 48 }}
        />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt weight="500">Sandbox mode</Txt>
            <Txt muted size={12}>Payments in new challenges you create settle instantly in-app.</Txt>
          </View>
          <Switch
            testID="sandbox-toggle"
            accessibilityLabel="sandbox-toggle"
            value={sandbox}
            onValueChange={toggle}
            disabled={user === undefined}
            trackColor={{ false: T.line, true: T.blue }}
            thumbColor={T.fg}
            ios_backgroundColor={T.line}
          />
        </View>
      </Card>

      {err ? <Txt size={13} style={{ color: T.red }}>{err}</Txt> : null}
      <Txt muted size={12} style={{ textAlign: "center" }}>doubt · Prove them wrong. Get paid.</Txt>
    </Page>
  );
}
