import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { useMe } from "@/me";
import { T } from "@/theme";
import { errText } from "@/ui";
import { Btn, Card, Chip, Field, Label, Page, TopBar, Txt } from "@/kit-b";

type Kind = "steps" | "gym" | "run" | "custom";
const KINDS: { kind: Kind; label: string; goal: string }[] = [
  { kind: "steps", label: "Steps", goal: "10k steps today" },
  { kind: "gym", label: "Gym", goal: "Hit the gym today" },
  { kind: "run", label: "Run", goal: "Run 5k today" },
  { kind: "custom", label: "Custom", goal: "" },
];
const DURATIONS = [
  { label: "5 min", end: () => Date.now() + 5 * 60_000 },
  { label: "1 hour", end: () => Date.now() + 3_600_000 },
  { label: "Today", end: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.getTime(); } },
  { label: "24 hours", end: () => Date.now() + 86_400_000 },
];
const STAKES = [10, 20, 50];

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const shortSteps = (n: number) => (n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString());

export default function Create() {
  const { deviceId, name } = useMe();
  const create = useMutation(api.challenges.create);
  const [kind, setKind] = useState<Kind>("steps");
  const [goal, setGoal] = useState(KINDS[0].goal);
  const [target, setTarget] = useState(10000);
  const [stake, setStake] = useState("20");
  const [dur, setDur] = useState(2);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const stakeNum = Math.max(0, parseFloat(stake) || 0);
  const stakeLabel = `$${Number.isInteger(stakeNum) ? stakeNum : stakeNum.toFixed(2)}`;
  const isSteps = kind === "steps";

  const pickKind = (k: Kind) => {
    setKind(k);
    setGoal(KINDS.find((x) => x.kind === k)!.goal);
  };
  const bump = (d: number) => {
    const next = Math.max(1000, target + d);
    setTarget(next);
    if (/^\d+k steps today$/.test(goal) || goal === "") setGoal(`${shortSteps(next)} steps today`);
  };

  const submit = async () => {
    setErr("");
    const stakeCents = Math.round(stakeNum * 100);
    if (!goal.trim()) return setErr("Give your challenge a goal.");
    if (stakeCents < 100) return setErr("Stake at least $1.");
    setBusy(true);
    try {
      const id = await create({
        deviceId, goal: goal.trim(), kind, targetSteps: isSteps ? target : 0,
        stakeCents, bonusCents: 0, endsAt: DURATIONS[dur].end(),
      });
      router.replace({ pathname: "/challenge/[id]", params: { id } });
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const question = isSteps ? `Will you hit ${shortSteps(target)} steps ${dur === 2 ? "today" : `by ${timeOf(DURATIONS[dur].end())}`}?` : `Will you ${goal.trim().replace(/^./, (c) => c.toLowerCase()) || "do it"}?`;

  return (
    <Page
      footer={
        <>
          <Txt muted size={12} style={{ textAlign: "center" }}>Finish: get your {stakeLabel} back plus everything your doubters put in</Txt>
          {err ? <Txt size={13} style={{ color: T.red, textAlign: "center" }}>{err}</Txt> : null}
          <Btn title={`Stake ${stakeLabel} and open market`} onPress={submit} loading={busy} testID="create-submit" />
        </>
      }
    >
      <TopBar title="New challenge" />

      <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.card }}>
        {KINDS.map((k) => {
          const on = k.kind === kind;
          return (
            <Pressable key={k.kind} accessibilityLabel={`kind-${k.kind}`} onPress={() => pickKind(k.kind)}
              style={{ flex: 1, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: on ? T.fg : "transparent" }}>
              <Text style={{ fontSize: 14, color: on ? T.bg : T.muted, fontWeight: on ? "600" : "400" }}>{k.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ padding: 18, gap: 16 }}>
        {isSteps ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Stepper sign="−" label="Fewer steps" onPress={() => bump(-1000)} />
            <View style={{ alignItems: "center", gap: 2 }}>
              <Txt size={40} weight="500" style={{ letterSpacing: -1.5 }}>{target.toLocaleString()}</Txt>
              <Txt muted size={13}>steps by {timeOf(DURATIONS[dur].end())}</Txt>
            </View>
            <Stepper sign="+" label="More steps" onPress={() => bump(1000)} />
          </View>
        ) : null}
        <Field label="Goal" value={goal} onChangeText={setGoal} placeholder="What are you committing to?" testID="goal-input" />
        <View style={{ height: 1, backgroundColor: T.line }} />
        <View style={{ gap: 10 }}>
          <Label>Your stake</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {STAKES.map((v) => (
              <Chip key={v} label={`$${v}`} accent active={stakeNum === v} onPress={() => setStake(String(v))} testID={`stake-${v}`} />
            ))}
          </View>
          <Field value={stake} onChangeText={setStake} keyboardType="decimal-pad" placeholder="Custom amount" testID="stake-input" />
        </View>
        <View style={{ gap: 10 }}>
          <Label>Ends</Label>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {DURATIONS.map((d, i) => <Chip key={d.label} label={d.label} active={dur === i} onPress={() => setDur(i)} />)}
          </View>
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <Label>Your market will open as</Label>
        <Card dashed style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: T.line, alignItems: "center", justifyContent: "center" }}>
              <Txt size={11} weight="600">{(name[0] ?? "Y").toUpperCase()}</Txt>
            </View>
            <Txt size={13} weight="600">${(name || "you").toUpperCase().replace(/\s+/g, "")}</Txt>
            <Txt muted size={12}>opens on stake</Txt>
          </View>
          <Txt weight="500">{question}</Txt>
          <View style={{ flexDirection: "row", gap: 3, height: 6 }}>
            <View style={{ width: "50%", borderRadius: 3, backgroundColor: T.line }} />
            <View style={{ flex: 1, borderRadius: 3, backgroundColor: T.line }} />
          </View>
          <Txt muted size={12}>Friends can doubt you for up to {stakeLabel}</Txt>
        </Card>
      </View>
    </Page>
  );
}

function Stepper({ sign, label, onPress }: { sign: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: T.fg, fontSize: 22, fontWeight: "400", marginTop: -2 }}>{sign}</Text>
    </Pressable>
  );
}
