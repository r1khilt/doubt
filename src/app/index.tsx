import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T as K } from "@/theme";
import { Avatar, AvatarStack, Icon, IconButton, Screen, T, ago, errText } from "@/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

// "Rikhil", "Rikhil and Kimmy", "Rikhil, Kimmy and 3 others"
const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? "" : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length > 3 ? "s" : ""}`;

// "Oskar, Kimmy + 3"
const fewNames = (names: string[], count: number) => `${names.slice(0, 2).join(", ")}${count > 2 ? ` + ${count - 2}` : ""}`;

const hoursLeft = (endsAt: number, now: number) => {
  const m = Math.max(0, Math.floor((endsAt - now) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h left` : m > 0 ? `${m}m left` : "ended";
};

const openBoard = (challengeId: string, extra: Record<string, string> = {}) =>
  router.push({ pathname: "/challenge/[id]", params: { id: challengeId, ...extra } });

export default function Home() {
  const { deviceId } = useMe();
  const insets = useSafeAreaInsets();
  const home = useQuery(api.challenges.home, { deviceId });
  const challenges = useQuery(api.challenges.list, {});
  const seed = useMutation(api.seed.demo);
  const believe = useMutation(api.beliefs.toggle);
  const [now, setNow] = useState(Date.now());
  const [seedErr, setSeedErr] = useState("");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const loadDemo = async () => {
    setSeedErr("");
    setSeeding(true);
    try {
      await seed({ deviceId }); // stay on Home
    } catch (e) {
      setSeedErr(errText(e));
    } finally {
      setSeeding(false);
    }
  };

  const a = home?.active ?? null;
  const open = (challenges ?? []).filter((c) => c.status === "open" && c.endsAt > now);
  // Only list challenges not already reachable from my card or a friend card.
  const shown = new Set([a?.challengeId, ...(home?.friends ?? []).map((f) => f.challengeId)]);
  const joinable = open.filter((c) => !shown.has(c._id));
  const settled = (challenges ?? []).find((c) => c.status === "settled");
  const activeBoard = a?.challengeId ?? open[0]?._id;

  let headline = "";
  if (a) {
    const doubters = joinNames([...new Set(a.doubters.map((d) => d.name))]);
    const steps = a.kind === "steps";
    const done = a.verified || (steps && a.targetSteps > 0 && a.progress >= a.targetSteps);
    const left = Math.max(0, a.targetSteps - a.progress);
    if (!a.paid) headline = "Lock in your stake to start the clock.";
    else if (done) headline = doubters ? `You proved ${doubters} wrong.` : "You did it. Now collect.";
    else if (steps) headline = doubters ? `You're ${left.toLocaleString()} steps from proving ${doubters} wrong.` : `You're ${left.toLocaleString()} steps from ${a.goal}.`;
    else headline = doubters ? `Prove ${doubters} wrong. Check in with proof.` : `Check in with proof to finish ${a.goal}.`;
  }
  const pace = a ? Math.round(a.targetSteps * Math.min(1, Math.max(0, (now - a.startedAt) / Math.max(1, a.endsAt - a.startedAt)))) : 0;
  const ahead = a ? a.progress - pace : 0;

  const tabH = Math.max(84, 50 + insets.bottom);
  const tab = (icon: string, label: string, onPress: () => void, active = false) => (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={22} color={active ? K.fg : K.muted} />
    </Pressable>
  );

  return (
    <Screen
      gap={22}
      top={60}
      bottom={tabH + 36}
      footer={
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: tabH, borderTopWidth: 1, borderColor: K.line, backgroundColor: K.bg, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", paddingTop: 8, paddingHorizontal: 12 }}>
          {tab("home", "Home", () => router.navigate("/"), true)}
          {tab("trending", "Markets", () => activeBoard && openBoard(activeBoard))}
          <Pressable
            testID="new-challenge"
            accessibilityLabel="New challenge"
            accessibilityRole="button"
            onPress={() => router.push("/create")}
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: K.fg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="plus" size={22} color={K.bg} width={2.25} />
          </Pressable>
          {tab("pin", "Check in", () => a && router.push({ pathname: "/checkin/[id]", params: { id: a.participantId, c: a.challengeId } }))}
          {tab("trophy", "Results", () =>
            settled ? router.push({ pathname: "/results/[id]", params: { id: settled._id } }) : activeBoard && openBoard(activeBoard),
          )}
        </View>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T size={17} weight="600" style={{ letterSpacing: -0.34 }}>doubt</T>
        <IconButton icon="bell" label="Notifications" dot onPress={() => router.push("/settings")} />
      </View>

      {a ? (
        <>
          <View style={{ gap: 8 }}>
            <T size={13} muted>{DAYS[new Date(now).getDay()]} · {a.goal}</T>
            <T size={28} weight="600" lh={1.15} style={{ letterSpacing: -0.84 }}>{headline}</T>
          </View>

          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              {a.kind === "steps" ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <T size={40} weight="500" lh={1.15} style={{ letterSpacing: -1.6 }}>{a.progress.toLocaleString()}</T>
                  <T size={15} muted>/ {a.targetSteps.toLocaleString()}</T>
                </View>
              ) : (
                <T size={28} weight="500" style={{ letterSpacing: -1 }}>{a.verified ? "Verified" : "Awaiting proof"}</T>
              )}
              {a.kind === "steps" && a.status === "open" ? (
                <T size={13} weight="500" color={ahead >= 0 ? K.blue : K.yellow}>
                  {ahead >= 0 ? `+${ahead.toLocaleString()} ahead of pace` : `${(-ahead).toLocaleString()} behind pace`}
                </T>
              ) : null}
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: K.line, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, (a.verified ? 1 : a.targetSteps ? a.progress / a.targetSteps : 0) * 100)}%`, height: 6, backgroundColor: K.blue }} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 8, padding: 12, borderRadius: 12, backgroundColor: K.bg }}>
                <T size={12} muted>Doubting you · ${Math.round(a.doubtCents / 100)}</T>
                {a.doubters.length ? <AvatarStack names={[...new Set(a.doubters.map((d) => d.name))]} ring={K.yellow} /> : <View style={{ height: 28 }} />}
              </View>
              <View style={{ flex: 1, gap: 8, padding: 12, borderRadius: 12, backgroundColor: K.bg }}>
                <T size={12} muted>Believe in you · {a.believerCount}</T>
                {a.believers.length ? <AvatarStack names={a.believers.map((b) => b.name)} ring={K.blue} /> : <View style={{ height: 28 }} />}
              </View>
            </View>
            {a.paid ? (
              <Pressable
                testID="home-checkin"
                accessibilityLabel="Check in"
                onPress={() => router.push({ pathname: "/checkin/[id]", params: { id: a.participantId, c: a.challengeId } })}
                style={({ pressed }) => ({ height: 48, borderRadius: 12, backgroundColor: K.fg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="pin" size={18} color={K.bg} />
                <T size={15} weight="600" color={K.bg}>Check in</T>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => openBoard(a.challengeId)}
                style={({ pressed }) => ({ height: 48, borderRadius: 12, backgroundColor: K.fg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
              >
                <T size={15} weight="600" color={K.bg}>Pay ${Math.round(a.stakeCents / 100)} stake</T>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <T size={13} muted>{DAYS[new Date(now).getDay()]}</T>
          <T size={28} weight="600" lh={1.15} style={{ letterSpacing: -0.84 }}>Put money on it. Prove them wrong.</T>
        </View>
      )}

      {home?.latestPost ? (
        <Pressable
          onPress={() => openBoard(home.latestPost!.challengeId)}
          style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", gap: 12, alignItems: "flex-start", opacity: pressed ? 0.6 : 1 })}
        >
          <Avatar name={home.latestPost.authorName} size={32} />
          <View style={{ flex: 1, gap: 4 }}>
            <T size={13} muted>{home.latestPost.authorName} · {ago(home.latestPost._creationTime, now)} · on your challenge</T>
            <T size={15} lh={1.35}>{home.latestPost.text}</T>
            <T size={13} weight="600" color={K.blue}>Reply</T>
          </View>
        </Pressable>
      ) : null}

      {home && home.friends.length ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T size={15} weight="600">Your friends</T>
            <T size={13} muted>{home.friends.length} live</T>
          </View>
          {home.friends.map((f) => {
            const steps = f.kind === "steps";
            const days = Math.max(1, Math.round((f.endsAt - f.startedAt) / DAY_MS));
            const multiDay = !steps && days > 1;
            const day = Math.min(days, Math.floor((now - f.startedAt) / DAY_MS) + 1);
            const lastCheckin = (f as { lastCheckin?: string }).lastCheckin;
            const summary = [
              f.doubterCount ? `${fewNames(f.doubterNames, f.doubterCount)} doubt` : null,
              f.believerCount ? `${fewNames(f.believerNames, f.believerCount)} believe` : null,
            ].filter(Boolean).join(" · ");
            return (
              <View key={f.participantId} style={{ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 14 }}>
                <Pressable accessibilityLabel={`friend-${f.name}`} onPress={() => openBoard(f.challengeId, { p: f.participantId })} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar name={f.name} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={15} weight="600">{f.name}</T>
                    <T size={13} muted numberOfLines={1}>{f.goal} · {multiDay ? `day ${day}` : hoursLeft(f.endsAt, now)}</T>
                  </View>
                  <T size={13} weight="600" color={K.yellow}>{f.doubtPct}% doubt</T>
                </Pressable>
                {multiDay ? (
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {Array.from({ length: days }, (_, i) => (
                      <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < day ? K.blue : K.line }} />
                    ))}
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: K.line, overflow: "hidden" }}>
                      <View style={{ width: `${Math.min(100, (f.verified ? 1 : f.targetSteps ? f.progress / f.targetSteps : 0) * 100)}%`, height: 6, backgroundColor: K.fg }} />
                    </View>
                    {steps ? <T size={13} muted>{f.progress.toLocaleString()}</T> : null}
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <T size={13} muted style={{ flex: 1 }}>
                    {multiDay && lastCheckin ? `Checked in · "${lastCheckin}"` : summary || "No doubters yet"}
                  </T>
                  {!multiDay && f.postCount ? <T size={13} muted style={{ maxWidth: 64, textAlign: "left" }}>{f.postCount} replies</T> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    accessibilityLabel={`believe-${f.name}`}
                    onPress={() => believe({ deviceId, participantId: f.participantId as Id<"participants"> }).catch(() => {})}
                    style={({ pressed }) => ({
                      flex: 1, height: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.7 : 1,
                      ...(f.iBelieve ? { backgroundColor: K.blue } : { borderWidth: 1, borderColor: K.blue }),
                    })}
                  >
                    <Icon name="thumb" size={16} color={f.iBelieve ? K.bg : K.blue} />
                    <T size={14} weight="600" color={f.iBelieve ? K.bg : K.blue}>
                      {f.iBelieve ? (f.believerCount > 1 ? `You + ${f.believerCount - 1} believe` : "You believe") : `Believe · ${f.believerCount}`}
                    </T>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Doubt ${f.name}`}
                    disabled={!f.canDoubt}
                    onPress={() => openBoard(f.challengeId, { p: f.participantId, doubt: f.participantId })}
                    style={({ pressed }) => ({
                      flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", opacity: !f.canDoubt ? 0.45 : pressed ? 0.7 : 1,
                      ...(f.iBelieve ? { borderWidth: 1, borderColor: K.line } : { backgroundColor: K.yellow }),
                    })}
                  >
                    <T size={14} weight="600" color={f.iBelieve ? K.fg : K.bg}>Doubt {f.name}</T>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {joinable.length ? (
        <View>
          <T size={15} weight="600" style={{ marginBottom: 4 }}>Open challenges</T>
          {joinable.map((c) => (
            <Pressable
              key={c._id}
              accessibilityLabel={`challenge-${c.goal}`}
              onPress={() => openBoard(c._id)}
              style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderColor: K.line, gap: 4, opacity: pressed ? 0.5 : 1 })}
            >
              <T size={15} weight="500">{c.goal}</T>
              <T size={13} muted>${Math.round(c.stakeCents / 100)} stake · {c.participantCount} in · {hoursLeft(c.endsAt, now)}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: "auto" }}>
        <Pressable testID="load-demo" accessibilityLabel="Load demo" onPress={loadDemo} disabled={seeding} style={{ paddingVertical: 10, alignItems: "center", opacity: seeding ? 0.4 : 1 }}>
          <T size={13} color={K.dim}>{seeding ? "Loading…" : "Load demo"}</T>
        </Pressable>
        {seedErr ? <T size={13} red style={{ textAlign: "center" }}>{seedErr}</T> : null}
      </View>
    </Screen>
  );
}
