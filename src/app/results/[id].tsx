import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Share, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T } from "@/theme";
import { money } from "@/ui";
import { Avatar, AvatarStack, Btn, Page, TopBar, Txt } from "@/kit-b";

const REASON = { refund: "Refund", win: "Winnings", doubt_win: "Doubt win" } as const;
const joinNames = (n: string[]) => (n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deviceId } = useMe();
  const data = useQuery(api.challenges.get, { id: id as Id<"challenges">, deviceId });
  const retry = useMutation(api.payouts.retry);

  if (data === undefined) return <Page><TopBar title="Results" /><Txt muted>Loading…</Txt></Page>;
  if (data === null) return <Page><TopBar title="Results" /><Txt muted>Challenge not found.</Txt></Page>;

  const c = data.challenge;
  const isSteps = !c.kind || c.kind === "steps";
  const paid = data.participants.filter((p) => p.paid);
  const me = paid.find((p) => p.isMe);
  const myUserId = data.me.userId;
  const mine = data.payouts.filter((p) => p.userId === myUserId);
  const myWon = mine.filter((p) => p.reason !== "refund").reduce((s, p) => s + p.amountCents, 0);
  const myTotal = mine.reduce((s, p) => s + p.amountCents, 0);
  const mySent = mine.filter((p) => p.status === "sent").reduce((s, p) => s + p.amountCents, 0);
  const bettorsOn = (pid: string) => [...new Set(data.bets.filter((b) => b.targetId === pid).map((b) => b.bettorName))];
  const doubtOn = (pid: string) => data.bets.filter((b) => b.targetId === pid).reduce((s, b) => s + b.amountCents, 0);
  const quitters = paid.filter((p) => p.result === "quit");
  const finishers = paid.filter((p) => p.result === "finished");
  const allBettors = [...new Set(data.bets.map((b) => b.bettorName))];

  let headline: string;
  let faces: string[] = [];
  let facesLine = "";
  if (me?.result === "finished") {
    const d = bettorsOn(me._id);
    faces = d;
    headline = d.length ? `Proved ${plural(d.length, "doubter")} wrong.` : "Finished. Nobody dared doubt you.";
    if (d.length) facesLine = `${joinNames(d)} put ${money(doubtOn(me._id))} on it. Thanks, ${d.length === 1 ? "pal" : "guys"}.`;
  } else if (me?.result === "quit") {
    faces = bettorsOn(me._id);
    headline = "Not this time.";
    facesLine = faces.length ? `${joinNames(faces)} called it.` : "Run it back and prove them wrong.";
  } else if (myWon > 0) {
    headline = `Called it. +${money(myWon)}.`;
    faces = quitters.map((q) => q.name);
    facesLine = quitters.length ? `${joinNames(faces)} didn't make it.` : "";
  } else if (quitters.length) {
    faces = allBettors;
    headline = `${quitters.length === 1 ? quitters[0].name : plural(quitters.length, "challenger")} didn't make it.`;
    facesLine = allBettors.length ? `${plural(allBettors.length, "doubter")} cashed in.` : "";
  } else {
    faces = finishers.map((f) => f.name);
    headline = finishers.length ? "Everyone finished. Doubters paid up." : "Challenge settled.";
  }

  const q = quitters[0];
  const quitLine = q
    ? `${q.name} quit${isSteps ? ` at ${q.progress.toLocaleString()}` : ""}.${bettorsOn(q._id).length ? ` ${q.name === me?.name ? "Your" : "Their"} ${plural(bettorsOn(q._id).length, "doubter")} split ${money(Math.floor(doubtOn(q._id) * 1.95))}.` : ""}`
    : "";
  const topOther = [...new Set(data.payouts.map((p) => p.userId))]
    .filter((u) => u !== myUserId)
    .map((u) => ({ name: data.payouts.find((p) => p.userId === u)!.name, total: data.payouts.filter((p) => p.userId === u).reduce((s, p) => s + p.amountCents, 0) }))
    .sort((a, b) => b.total - a.total)[0];

  const stats = me
    ? [
        { v: isSteps ? me.progress.toLocaleString() : me.result === "finished" ? "Done" : "—", l: isSteps ? "steps" : "proof", blue: false },
        { v: `${myWon >= 0 ? "+" : ""}${money(myWon)}`, l: "won", blue: myWon > 0 },
        { v: String(me.believerCount), l: "believed", blue: false },
      ]
    : [
        { v: money(data.totals.inCents), l: "in the pot", blue: false },
        { v: myWon ? `+${money(myWon)}` : String(finishers.length), l: myWon ? "won" : "finished", blue: myWon > 0 },
        { v: String(quitters.length), l: "quit", blue: false },
      ];

  // People + their payouts.
  const people: { userId: string; name: string; did: string }[] = paid.map((p) => ({
    userId: p.userId, name: p.name, did: p.result === "finished" ? "Finished" : p.result === "quit" ? "Quit" : "Pending",
  }));
  for (const po of data.payouts) if (!people.some((x) => x.userId === po.userId)) people.push({ userId: po.userId, name: po.name, did: "Doubter" });
  for (const b of data.bets) if (!people.some((x) => x.name === b.bettorName)) people.push({ userId: `bettor-${b.bettorName}`, name: b.bettorName, did: "Doubter" });

  const share = () =>
    Share.share({ message: `${headline} ${c.goal} on doubt.${myWon > 0 ? ` +${money(myWon)}.` : ""} Prove them wrong. Get paid.` });

  const endTime = new Date(Math.min(Date.now(), c.endsAt)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tag = `${new Date(c.endsAt).toLocaleDateString([], { weekday: "short" }).toUpperCase()} · ${(isSteps ? `${c.targetSteps >= 1000 ? `${c.targetSteps / 1000}K` : c.targetSteps} steps` : c.goal).toUpperCase()}`;
  const meFrac = me && isSteps && c.targetSteps ? Math.min(1, me.progress / c.targetSteps) : me?.result === "finished" ? 1 : 0.4;

  return (
    <Page
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
      <TopBar small title={`Challenge settled · ${endTime}`} />

      <View style={{ borderRadius: 24, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, padding: 22, gap: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt size={14} weight="600" style={{ letterSpacing: -0.3 }}>doubt</Txt>
          <Txt muted size={11} weight="600" style={{ letterSpacing: 0.7 }}>{tag}</Txt>
        </View>
        <View style={{ gap: 12 }}>
          <Txt size={30} weight="600" style={{ lineHeight: 33, letterSpacing: -0.9 }} testID="results-headline">{headline}</Txt>
          {faces.length || facesLine ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {faces.length ? <AvatarStack names={faces} ring={T.yellow} size={30} /> : null}
              {facesLine ? <Txt muted size={14} style={{ flex: 1 }}>{facesLine}</Txt> : null}
            </View>
          ) : null}
        </View>

        <View style={{ height: 64 }}>
          <View style={{ position: "absolute", left: 15, right: 15, top: 31, height: 2, backgroundColor: T.line }} />
          <View style={{ position: "absolute", left: 15, top: 31, height: 2, width: `${meFrac * 88}%`, backgroundColor: T.blue }} />
          {paid.filter((p) => !p.isMe).slice(0, 4).map((p) => {
            const f = isSteps && c.targetSteps ? Math.min(1, p.progress / c.targetSteps) : p.result === "finished" ? 1 : 0.3;
            return (
              <View key={p._id} style={{ position: "absolute", top: 17, left: `${f * 82}%`, borderWidth: 2, borderColor: T.card, borderRadius: 17 }}>
                <Avatar name={p.name} size={26} />
              </View>
            );
          })}
          {me ? (
            <View style={{ position: "absolute", top: 13, left: `${meFrac * 82}%`, borderWidth: 3, borderColor: T.card, borderRadius: 22 }}>
              <Avatar name={me.name} size={34} filled={T.blue} />
            </View>
          ) : null}
          <Txt muted size={11} style={{ position: "absolute", left: 0, top: 52 }}>start</Txt>
          <Txt muted size={11} style={{ position: "absolute", right: 0, top: 52 }}>{isSteps ? c.targetSteps.toLocaleString() : "done"}</Txt>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {stats.map((s) => (
            <View key={s.l} style={{ flex: 1, gap: 4, padding: 12, borderRadius: 12, backgroundColor: T.bg }}>
              <Txt size={20} weight="500" style={{ letterSpacing: -0.6, color: s.blue ? T.blue : T.fg }}>{s.v}</Txt>
              <Txt muted size={11}>{s.l}</Txt>
            </View>
          ))}
        </View>
        {quitLine ? <Txt muted size={12}>{quitLine}</Txt> : null}
      </View>

      {mySent > 0 || topOther ? (
        <Txt muted size={12} style={{ textAlign: "center" }}>
          {mySent > 0 ? `${money(mySent)} sent to your Whop balance` : myTotal > 0 ? `${money(myTotal)} on its way to your Whop balance` : ""}
          {(mySent > 0 || myTotal > 0) && topOther ? " · " : ""}
          {topOther ? `${topOther.name} got ${money(topOther.total)}` : ""}
        </Txt>
      ) : null}

      <View style={{ gap: 4 }}>
        <Txt size={20} weight="600" style={{ letterSpacing: -0.4 }}>Results</Txt>
        <Txt muted size={13}>Total in {money(data.totals.inCents)} · Total out {money(data.totals.outCents)}</Txt>
      </View>

      <View style={{ gap: 0 }}>
        {people.map((person) => {
          const rows = data.payouts.filter((po) => po.userId === person.userId);
          const total = rows.reduce((s, r) => s + r.amountCents, 0);
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
        {people.length === 0 ? <Txt muted>No payouts.</Txt> : null}
      </View>
    </Page>
  );
}
