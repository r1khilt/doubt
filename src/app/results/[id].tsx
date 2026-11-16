import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T } from "@/theme";
import { money } from "@/ui";
import { Avatar, AvatarStack, Btn, Page, TopBar, Txt } from "@/kit-b";

const REASON = { refund: "Refund", win: "Winnings", doubt_win: "Doubt win" } as const;
const joinNames = (n: string[]) => (n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const net = (c: number) => Math.floor(c * 0.95);

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deviceId } = useMe();
  const data = useQuery(api.challenges.get, { id: id as Id<"challenges">, deviceId });
  const retry = useMutation(api.payouts.retry);
  const [openedAt] = useState(Date.now());
  const [showAll, setShowAll] = useState(false);
  const [w, setW] = useState(304);

  if (data === undefined) return <Page><TopBar small title="Results" /><Txt muted>Loading…</Txt></Page>;
  if (data === null) return <Page><TopBar small title="Results" /><Txt muted>Challenge not found.</Txt></Page>;

  const c = data.challenge;
  const isSteps = !c.kind || c.kind === "steps";
  const paid = data.participants.filter((p) => p.paid);
  const me = paid.find((p) => p.isMe);
  const myUserId = data.me.userId;
  const mine = data.payouts.filter((p) => p.userId === myUserId);
  const myWon = mine.filter((p) => p.reason !== "refund").reduce((s, p) => s + p.amountCents, 0);
  const myTotal = mine.reduce((s, p) => s + p.amountCents, 0);
  const mySent = mine.filter((p) => p.status === "sent").reduce((s, p) => s + p.amountCents, 0);
  const betsOn = (pid: string) => data.bets.filter((b) => b.targetId === pid);
  const bettorsOn = (pid: string) => [...new Set(betsOn(pid).map((b) => b.bettorName))];
  const quitters = paid.filter((p) => p.result === "quit");
  const finishers = paid.filter((p) => p.result === "finished");
  const allBettors = [...new Set(data.bets.map((b) => b.bettorName))];

  let headline = "Challenge settled.";
  let faces: string[] = [];
  let facesLine = "";
  if (me?.result === "finished") {
    faces = bettorsOn(me._id);
    const put = betsOn(me._id).reduce((s, b) => s + b.amountCents, 0);
    headline = faces.length ? `Proved ${plural(faces.length, "doubter")} wrong.` : "Finished. Nobody dared doubt you.";
    if (faces.length) facesLine = `${joinNames(faces)} put ${money(put)} on it. Thanks, ${faces.length === 1 ? "pal" : "guys"}.`;
  } else if (me?.result === "quit") {
    faces = bettorsOn(me._id);
    headline = "Not this time.";
    facesLine = faces.length ? `${joinNames(faces)} called it.` : "Run it back and prove them wrong.";
  } else if (myWon > 0) {
    headline = `Called it. +${money(myWon)}.`;
    faces = quitters.map((q) => q.name);
    if (faces.length) facesLine = `${joinNames(faces)} didn't make it.`;
  } else if (quitters.length) {
    faces = allBettors;
    headline = `${quitters.length === 1 ? quitters[0].name : plural(quitters.length, "challenger")} didn't make it.`;
    if (allBettors.length) facesLine = `${plural(allBettors.length, "doubter")} cashed in.`;
  } else if (finishers.length) {
    faces = finishers.map((f) => f.name);
    headline = "Everyone finished. Doubters paid up.";
  }

  const q = quitters.find((x) => !x.isMe) ?? quitters[0];
  const qBets = q ? betsOn(q._id) : [];
  const quitLine = q
    ? `${q.name} quit${isSteps ? ` at ${q.progress.toLocaleString()}` : ""}.${qBets.length ? ` ${plural(bettorsOn(q._id).length, "doubter")} split ${money(qBets.reduce((s, b) => s + b.amountCents + net(b.amountCents), 0))}.` : ""}`
    : "";
  const topOther = [...new Set(data.payouts.map((p) => p.userId))]
    .filter((u) => u !== myUserId)
    .map((u) => ({ name: data.payouts.find((p) => p.userId === u)!.name, total: data.payouts.filter((p) => p.userId === u).reduce((s, p) => s + p.amountCents, 0) }))
    .sort((a, b) => b.total - a.total)[0];
  const balanceLine = [
    mySent > 0 ? `${money(mySent)} sent to your Whop balance` : myTotal > 0 ? `${money(myTotal)} on its way to your Whop balance` : "",
    topOther ? `${topOther.name} got ${money(topOther.total)}` : "",
  ].filter(Boolean).join(" · ");

  const stats = me
    ? [
        { v: isSteps ? me.progress.toLocaleString() : me.result === "finished" ? "Done" : "—", l: isSteps ? "steps" : "proof", blue: false },
        { v: `+${money(myWon)}`, l: "won", blue: myWon > 0 },
        { v: String(me.believerCount), l: "believed", blue: false },
      ]
    : [
        { v: money(data.totals.inCents), l: "in the pot", blue: false },
        { v: myWon ? `+${money(myWon)}` : String(finishers.length), l: myWon ? "won" : "finished", blue: myWon > 0 },
        { v: String(quitters.length), l: "quit", blue: false },
      ];

  const settledAt = new Date(Math.min(openedAt, c.endsAt)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = new Date(c.startedAt ?? c._creationTime).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const tag = `${day} · ${isSteps ? `${c.targetSteps % 1000 === 0 ? `${c.targetSteps / 1000}K` : c.targetSteps.toLocaleString()} STEPS` : c.goal.toUpperCase()}`;
  const fracOf = (p: { progress: number; result: string; verified: boolean }) =>
    p.result === "finished" || p.verified ? 1 : isSteps && c.targetSteps ? Math.min(1, p.progress / c.targetSteps) : 0.2;
  const meFrac = me ? fracOf(me) : 0;
  const others = paid.filter((p) => !p.isMe).sort((a, b) => fracOf(a) - fracOf(b)).slice(-3);

  const people: { userId: string; name: string; did: string }[] = paid.map((p) => ({
    userId: p.userId, name: p.name, did: p.result === "finished" ? "Finished" : p.result === "quit" ? "Quit" : "Pending",
  }));
  for (const po of data.payouts) if (!people.some((x) => x.userId === po.userId)) people.push({ userId: po.userId, name: po.name, did: "Doubter" });

  const share = () => Share.share({ message: `${headline} ${c.goal} on doubt.${myWon > 0 ? ` +${money(myWon)}.` : ""} Prove them wrong. Get paid.` });

  return (
    <Page
      gap={16}
      footer={
        <>
          <Btn title="Share to story" onPress={share} testID="share-story" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn title="Send to chat" variant="dark" onPress={share} style={{ flex: 1, height: 52 }} />
            <Btn title="Run it back" variant="outlineBlue" onPress={() => router.push("/create")} style={{ flex: 1, height: 52 }} testID="run-it-back" />
          </View>
        </>
      }
    >
      <TopBar small title={`Challenge settled · ${settledAt}`} />

      <View style={{ borderRadius: 24, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, padding: 22, gap: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt size={14} weight="600" ls={-0.02}>doubt</Txt>
          <Txt muted size={11} weight="600" ls={0.06} numberOfLines={1} style={{ flexShrink: 1, marginLeft: 12 }}>{tag}</Txt>
        </View>

        <View style={{ gap: 12 }}>
          <Txt size={30} weight="600" ls={-0.03} style={{ lineHeight: 33 }} testID="results-headline">{headline}</Txt>
          {faces.length || facesLine ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {faces.length ? <AvatarStack names={faces} ring={T.yellow} size={30} /> : null}
              {facesLine ? <Txt muted size={14} style={{ flex: 1 }}>{facesLine}</Txt> : null}
            </View>
          ) : null}
        </View>

        <View style={{ height: 64 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          <View style={{ position: "absolute", left: 15, right: 15, top: 31, height: 2, backgroundColor: T.line }} />
          <View style={{ position: "absolute", left: 15, top: 31, height: 2, width: Math.max(0, meFrac * (w - 30)), backgroundColor: T.blue }} />
          {others.map((p, i) => {
            const f = fracOf(p);
            const pos = f >= 1 ? { right: 26 + (others.filter((o) => fracOf(o) >= 1).indexOf(p)) * 18 } : { left: Math.max(0, f * (w - 30)) };
            return (
              <View key={p._id} style={{ position: "absolute", top: 17, zIndex: i, ...pos }}>
                <Avatar name={p.name} size={30} ring={T.card} color={p.result === "quit" ? T.muted : T.fg} />
              </View>
            );
          })}
          {me ? (
            <View style={{ position: "absolute", top: 13, zIndex: 9, ...(meFrac >= 1 ? { right: 0 } : { left: Math.max(0, meFrac * (w - 38)) }) }}>
              <Avatar name={me.name} size={38} ring={T.card} ringWidth={3} bg={T.blue} color={T.bg} fontSize={13} />
            </View>
          ) : null}
          <Txt muted size={11} style={{ position: "absolute", left: 0, top: 52 }}>start</Txt>
          <Txt muted size={11} style={{ position: "absolute", right: 0, top: 52 }}>{isSteps ? c.targetSteps.toLocaleString() : "done"}</Txt>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {stats.map((st) => (
            <View key={st.l} style={{ flex: 1, gap: 4, padding: 12, borderRadius: 12, backgroundColor: T.bg }}>
              <Txt size={st.v.length > 6 ? 16 : 20} weight="500" ls={-0.03} style={{ color: st.blue ? T.blue : T.fg }} numberOfLines={1}>{st.v}</Txt>
              <Txt muted size={11}>{st.l}</Txt>
            </View>
          ))}
        </View>
        {quitLine ? <Txt muted size={12}>{quitLine}</Txt> : null}
      </View>

      {balanceLine ? <Txt muted size={12} style={{ textAlign: "center" }}>{balanceLine}</Txt> : null}

      <Pressable onPress={() => setShowAll((v) => !v)} accessibilityLabel="toggle-results" style={{ alignSelf: "center", paddingVertical: 6 }}>
        <Txt size={13} weight="500" style={{ color: T.muted }}>Results · Total in {money(data.totals.inCents)} {showAll ? "⌃" : "›"}</Txt>
      </Pressable>

      {showAll ? (
        <View>
          {people.map((person) => {
            const rows = data.payouts.filter((po) => po.userId === person.userId);
            const total = rows.reduce((sum, r) => sum + r.amountCents, 0);
            return (
              <View key={person.userId} style={{ paddingVertical: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: T.line }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar name={person.name} size={30} ring={person.did === "Doubter" ? T.yellow : undefined} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="500">{person.name}{person.userId === myUserId ? " · you" : ""}</Txt>
                    <Txt size={12} style={{ color: person.did === "Quit" ? T.red : person.did === "Finished" ? T.blue : T.muted }}>{person.did}</Txt>
                  </View>
                  <Txt weight="600" style={{ color: total ? T.fg : T.dim }}>{money(total)}</Txt>
                </View>
                {rows.map((r) => (
                  <View key={r._id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingLeft: 40 }}>
                    <Txt muted size={13}>{REASON[r.reason]} · {money(r.amountCents)}</Txt>
                    {r.status === "failed" ? (
                      <Btn title="Retry" variant="dark" onPress={() => retry({ payoutId: r._id })} testID="retry-payout" style={{ height: 32, paddingHorizontal: 14, borderRadius: 10 }} />
                    ) : (
                      <Txt size={13} style={{ color: r.status === "sent" ? T.blue : T.muted }}>{r.status === "sent" ? "Sent" : "Queued"}</Txt>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
          <Txt muted size={12} style={{ paddingTop: 12 }}>Total in {money(data.totals.inCents)} · Total out {money(data.totals.outCents)}</Txt>
        </View>
      ) : null}
    </Page>
  );
}
