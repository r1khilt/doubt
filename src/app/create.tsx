import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api } from "@convex/_generated/api";
import { useMe } from "@/me";
import { T } from "@/theme";
import { errText } from "@/ui";
import { Btn, IconMinus, IconPlus, Label, Page, RoundButton, TopBar, Txt, s } from "@/kit-b";

type Kind = "steps" | "gym" | "run" | "custom";
const KINDS: { kind: Kind; label: string; goal: string; big: string }[] = [
  { kind: "steps", label: "Steps", goal: "10k steps today", big: "" },
  { kind: "gym", label: "Gym", goal: "hit the gym today", big: "Gym" },
  { kind: "run", label: "Run", goal: "run 5k today", big: "5k" },
  { kind: "custom", label: "Custom", goal: "do it today", big: "Custom" },
];
const STAKES = [10, 20, 50];

// End-time options; tap the "steps by …" line to cycle (default 9:00 PM today).
const at9pm = () => {
  const d = new Date();
  d.setHours(21, 0, 0, 0);
  return d.getTime() - Date.now() > 10 * 60_000 ? d.getTime() : Date.now() + 24 * 3_600_000;
};
const ENDS = [at9pm, () => Date.now() + 5 * 60_000, () => Date.now() + 3_600_000, () => Date.now() + 24 * 3_600_000];
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const shortSteps = (n: number) => (n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString());

export default function Create() {
  const { deviceId, name } = useMe();
  const create = useMutation(api.challenges.create);
  const [kind, setKind] = useState<Kind>("steps");
  const [target, setTarget] = useState(10000);
  const [question, setQuestion] = useState("Will you hit 10k steps today?");
  const [edited, setEdited] = useState(false);
  const [stake, setStake] = useState(20);
  const [end, setEnd] = useState(0);
  const [endsAt, setEndsAt] = useState(() => ENDS[0]());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const isSteps = kind === "steps";
  const autoQuestion = (k: Kind, t: number) => (k === "steps" ? `Will you hit ${shortSteps(t)} steps today?` : `Will you ${KINDS.find((x) => x.kind === k)!.goal}?`);

  const pickKind = (k: Kind) => {
    setKind(k);
    if (!edited) setQuestion(autoQuestion(k, target));
  };
  const bump = (d: number) => {
    const t = Math.max(1000, target + d);
    setTarget(t);
    if (!edited) setQuestion(autoQuestion("steps", t));
  };
  const cycleEnd = () => {
    const i = (end + 1) % ENDS.length;
    setEnd(i);
    setEndsAt(ENDS[i]());
  };
  // "Will you hit 10k steps today?" → goal "10k steps today"
  const goalFrom = (q: string) => {
    const t = q.trim();
    return (t.match(/^will you hit (.+?)\??$/i)?.[1] ?? t.match(/^will you (.+?)\??$/i)?.[1] ?? t.replace(/\?$/, "")).trim();
  };

  const submit = async () => {
    setErr("");
    const goal = goalFrom(question);
    if (!goal) return setErr("Say what you're committing to.");
    setBusy(true);
    try {
      const id = await create({
        deviceId, kind, targetSteps: isSteps ? target : 0, stakeCents: stake * 100, bonusCents: 0,
        goal: goal[0].toUpperCase() + goal.slice(1), endsAt: end === 0 ? endsAt : ENDS[end](),
      });
      router.replace({ pathname: "/challenge/[id]", params: { id } });
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      gap={20}
      footer={
        <>
          <Txt muted size={12} style={{ textAlign: "center" }}>Finish: get your ${stake} back plus everything your doubters put in</Txt>
          {err ? <Txt size={13} style={{ color: T.red, textAlign: "center" }}>{err}</Txt> : null}
          <Btn title={`Stake $${stake} and open market`} onPress={submit} loading={busy} testID="create-submit" />
        </>
      }
    >
      <TopBar title="New challenge" />

      <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.card }}>
        {KINDS.map((k) => {
          const on = k.kind === kind;
          return (
            <Pressable key={k.kind} accessibilityLabel={`kind-${k.kind}`} accessibilityState={{ selected: on }} onPress={() => pickKind(k.kind)}
              style={{ flex: 1, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: on ? T.fg : "transparent" }}>
              <Text style={{ fontSize: 14, color: on ? T.bg : T.muted, fontWeight: on ? "600" : "400" }}>{k.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[s.card, { padding: 18, gap: 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {isSteps ? <RoundButton transparent label="Fewer steps" onPress={() => bump(-1000)}><IconMinus /></RoundButton> : <View style={{ width: 44 }} />}
          <Pressable onPress={cycleEnd} accessibilityLabel="change-end-time" style={{ alignItems: "center", gap: 2 }}>
            <Txt size={40} weight="500" ls={-0.04}>{isSteps ? target.toLocaleString() : KINDS.find((x) => x.kind === kind)!.big}</Txt>
            <Txt muted size={13}>{isSteps ? "steps" : "proof"} by {timeOf(end === 0 ? endsAt : ENDS[end]())}</Txt>
          </Pressable>
          {isSteps ? <RoundButton transparent label="More steps" onPress={() => bump(1000)}><IconPlus /></RoundButton> : <View style={{ width: 44 }} />}
        </View>
        <View style={{ height: 1, backgroundColor: T.line }} />
        <View style={{ gap: 10 }}>
          <Label>Your stake</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {STAKES.map((v) => {
              const on = v === stake;
              return (
                <Pressable key={v} testID={`stake-${v}`} accessibilityLabel={`stake-${v}`} accessibilityState={{ selected: on }} onPress={() => setStake(v)}
                  style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: on ? 1.5 : 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blue : "transparent" }}>
                  <Text style={{ fontSize: 15, color: on ? T.bg : T.fg, fontWeight: on ? "600" : "400" }}>${v}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Label>Your market will open as</Label>
        <View style={{ borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: T.muted, backgroundColor: T.card, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: T.line, alignItems: "center", justifyContent: "center" }}>
              <Txt size={11} weight="600">{(name[0] ?? "Y").toUpperCase()}</Txt>
            </View>
            <Txt size={13} weight="600">$YOU</Txt>
            <Txt muted size={12}>opens on stake</Txt>
          </View>
          <TextInput
            testID="goal-input"
            accessibilityLabel="goal-input"
            value={question}
            onChangeText={(t) => { setQuestion(t); setEdited(true); }}
            placeholder="Will you …?"
            placeholderTextColor={T.dim}
            style={{ color: T.fg, fontSize: 15, fontWeight: "500", padding: 0 }}
          />
          <View style={{ flexDirection: "row", gap: 3, height: 6 }}>
            <View style={{ width: "50%", borderRadius: 3, backgroundColor: T.line }} />
            <View style={{ flex: 1, borderRadius: 3, backgroundColor: T.line }} />
          </View>
          <Txt muted size={12}>Friends can doubt you for up to ${stake}</Txt>
        </View>
      </View>
    </Page>
  );
}
