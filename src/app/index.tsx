import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T as K } from "@/theme";
import { Avatar, AvatarStack, Button, Card, IconButton, ProgressBar, Screen, T, ago, errText, money, timeLeft } from "@/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "Rikhil", "Rikhil and Kimmy", "Rikhil, Kimmy and 3 others"
const joinNames = (names: string[]) =>
  names.length <= 1 ? names[0] ?? "" : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length > 3 ? "s" : ""}`;

const openBoard = (challengeId: string, extra: Record<string, string> = {}) =>
  router.push({ pathname: "/challenge/[id]", params: { id: challengeId, ...extra } });

export default function Home() {
  const { deviceId } = useMe();
  const home = useQuery(api.challenges.home, { deviceId });
  const challenges = useQuery(api.challenges.list, {});
  const seed = useMutation(api.seed.demo);
  const believe = useMutation(api.beliefs.toggle);
  const [now, setNow] = useState(Date.now());
  const [seedErr, setSeedErr] = useState("");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadDemo = async () => {
    setSeedErr("");
    setSeeding(true);
    try {
      const id = await seed({ deviceId });
      openBoard(id);
    } catch (e) {
      setSeedErr(errText(e));
    } finally {
      setSeeding(false);
    }
  };

  const a = home?.active ?? null;
  const open = (challenges ?? []).filter((c) => c.status === "open" && c.endsAt > now);

  let headline = "";
  if (a) {
    const doubters = joinNames([...new Set(a.doubters.map((d) => d.name))]);
    const steps = a.kind === "steps" || !a.kind;
    const done = a.verified || (steps && a.targetSteps > 0 && a.progress >= a.targetSteps);
    const left = Math.max(0, a.targetSteps - a.progress);
    if (!a.paid) headline = "Lock in your stake to start the clock.";
    else if (done) headline = doubters ? `You proved ${doubters} wrong.` : "You did it. Now collect.";
    else if (steps) headline = doubters ? `You're ${left.toLocaleString()} steps from proving ${doubters} wrong.` : `You're ${left.toLocaleString()} steps from ${a.goal}.`;
    else headline = doubters ? `Prove ${doubters} wrong. Check in with proof.` : `Check in with proof to finish ${a.goal}.`;
  }

  return (
    <Screen
      footer={
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 32, alignItems: "center" }}>
          <Pressable
            testID="new-challenge"
            accessibilityLabel="New challenge"
            onPress={() => router.push("/create")}
            style={({ pressed }) => ({
              height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: K.fg, flexDirection: "row", alignItems: "center", gap: 8,
              opacity: pressed ? 0.7 : 1, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
            })}
          >
            <T color={K.bg} size={22} weight="500" style={{ marginTop: -2 }}>+</T>
            <T color={K.bg} weight="600">New challenge</T>
          </Pressable>
        </View>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T size={17} weight="600" style={{ letterSpacing: -0.3 }}>doubt</T>
        <IconButton glyph="⚙︎" label="Settings" onPress={() => router.push("/settings")} />
      </View>

      {a ? (
        <>
          <View style={{ gap: 8 }}>
            <T small muted>{DAYS[new Date(now).getDay()]} · {a.goal}</T>
            <T size={28} weight="600" style={{ letterSpacing: -0.8, lineHeight: 32 }}>{headline}</T>
          </View>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              {a.kind === "steps" || !a.kind ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <T size={40} weight="500" style={{ letterSpacing: -1.6, lineHeight: 46 }}>{a.progress.toLocaleString()}</T>
                  <T muted>/ {a.targetSteps.toLocaleString()}</T>
                </View>
              ) : (
                <T size={28} weight="500" style={{ letterSpacing: -1 }}>{a.verified ? "Verified" : "Awaiting proof"}</T>
              )}
              <T small weight="500" color={K.blue}>{a.status === "open" ? timeLeft(a.endsAt, now) : "Settled"}</T>
            </View>
            <ProgressBar value={a.verified ? 1 : a.targetSteps ? a.progress / a.targetSteps : 0} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 8, padding: 12, borderRadius: 12, backgroundColor: K.bg }}>
                <T size={12} muted>Doubting you · {money(a.doubtCents)}</T>
                {a.doubters.length ? <AvatarStack names={a.doubters.map((d) => d.name)} ring={K.yellow} /> : <T size={12} color={K.dim}>No one yet</T>}
              </View>
              <View style={{ flex: 1, gap: 8, padding: 12, borderRadius: 12, backgroundColor: K.bg }}>
                <T size={12} muted>Believe in you · {a.believers.length}</T>
                {a.believers.length ? <AvatarStack names={a.believers.map((b) => b.name)} ring={K.blue} /> : <T size={12} color={K.dim}>No one yet</T>}
              </View>
            </View>
            {a.paid ? (
              <Button title="⌖  Check in" testID="home-checkin" height={48} onPress={() => router.push({ pathname: "/checkin/[id]", params: { id: a.participantId, c: a.challengeId } })} />
            ) : (
              <Button title={`Pay ${money(a.stakeCents)} stake`} height={48} onPress={() => openBoard(a.challengeId)} />
            )}
          </Card>
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <T small muted>{DAYS[new Date(now).getDay()]}</T>
          <T size={28} weight="600" style={{ letterSpacing: -0.8, lineHeight: 32 }}>Put money on it. Prove them wrong.</T>
        </View>
      )}

      {home?.latestPost ? (
        <Pressable onPress={() => openBoard(home.latestPost!.challengeId)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Card style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 14 }}>
            <Avatar name={home.latestPost.authorName} />
            <View style={{ flex: 1, gap: 4 }}>
              <T small muted>{home.latestPost.authorName} · {ago(home.latestPost._creationTime, now)} · on your challenge</T>
              <T style={{ lineHeight: 20 }}>{home.latestPost.text || (home.latestPost.type === "doubt" ? "doubted you" : home.latestPost.type === "believe" ? "believes in you" : "checked in")}</T>
              <T small weight="600" color={K.blue}>Reply</T>
            </View>
          </Card>
        </Pressable>
      ) : null}

      {home && home.friends.length ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T size={15} weight="600">Your friends</T>
            <T small muted>{home.friends.length} live</T>
          </View>
          {home.friends.map((f) => {
            const steps = f.kind === "steps" || !f.kind;
            const summary = [
              f.doubterNames.length ? `${f.doubterNames.slice(0, 2).join(", ")}${f.doubterNames.length > 2 ? ` + ${f.doubterNames.length - 2}` : ""} doubt` : null,
              f.believerNames.length ? `${f.believerNames.slice(0, 2).join(", ")}${f.believerNames.length > 2 ? ` + ${f.believerNames.length - 2}` : ""} believe` : null,
              f.postCount ? `${f.postCount} replies` : null,
            ].filter(Boolean).join(" · ");
            return (
              <Pressable key={f.participantId} accessibilityLabel={`friend-${f.name}`} onPress={() => openBoard(f.challengeId, { p: f.participantId })}>
                <Card style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <Avatar name={f.name} ring={f.doubtCents ? K.yellow : undefined} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T weight="600">{f.name}</T>
                      <T small muted numberOfLines={1}>{f.goal} · {timeLeft(f.endsAt, now)}</T>
                    </View>
                    <T small weight="600" color={K.yellow}>{f.doubtPct}% doubt</T>
                  </View>
                  <View style={{ gap: 6 }}>
                    <ProgressBar value={f.verified ? 1 : f.targetSteps ? f.progress / f.targetSteps : 0} color={K.fg} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <T size={12} muted numberOfLines={1} style={{ flex: 1 }}>{summary || "No doubters yet"}</T>
                      <T size={12} muted>{f.verified ? "Verified" : steps ? `${f.progress.toLocaleString()} / ${f.targetSteps.toLocaleString()}` : "No proof yet"}</T>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button
                      style={{ flex: 1 }} height={44} variant="believe"
                      title={f.iBelieve ? `Believing · ${f.believerCount}` : `Believe · ${f.believerCount}`}
                      onPress={() => believe({ deviceId, participantId: f.participantId as Id<"participants"> }).catch(() => {})}
                    />
                    <Button
                      style={{ flex: 1 }} height={44} variant="doubt" title={`Doubt ${f.name}`} disabled={!f.canDoubt}
                      onPress={() => openBoard(f.challengeId, { p: f.participantId, doubt: f.participantId })}
                    />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <T size={15} weight="600">Open challenges</T>
        {challenges === undefined ? (
          <T small muted>Loading…</T>
        ) : open.length === 0 ? (
          <T small muted>Nothing live. Start one.</T>
        ) : (
          open.map((c) => (
            <Pressable
              key={c._id}
              accessibilityLabel={`challenge-${c.goal}`}
              onPress={() => openBoard(c._id)}
              style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderColor: K.line, gap: 4, opacity: pressed ? 0.5 : 1 })}
            >
              <T weight="500">{c.goal}</T>
              <T small muted>{money(c.stakeCents)} stake · {c.participantCount} in · {money(c.potCents)} pot · {timeLeft(c.endsAt, now)}</T>
            </Pressable>
          ))
        )}
      </View>

      <View style={{ marginTop: "auto", paddingBottom: 72 }}>
        <Button title="Load demo" variant="text" onPress={loadDemo} loading={seeding} testID="load-demo" />
        {seedErr ? <T small red style={{ textAlign: "center" }}>{seedErr}</T> : null}
      </View>
    </Screen>
  );
}
