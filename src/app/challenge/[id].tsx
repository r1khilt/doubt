import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { Pedometer } from "expo-sensors";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Pressable, Share, TextInput, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T as K } from "@/theme";
import { Avatar, Button, Card, Chip, IconButton, Input, ProgressBar, Screen, Sheet, T, ago, errText, money, timeLeft } from "@/ui";

const openCheckout = (url: string) => WebBrowser.openAuthSessionAsync(url, Linking.createURL("paid")).catch(() => {});
const CHIPS = [2, 5, 10, 20];
type Pay = { kind: "stake" | "bet"; rowId: string; amountCents: number; label: string };

export default function Board() {
  const params = useLocalSearchParams<{ id: string; p?: string; doubt?: string }>();
  const challengeId = params.id as Id<"challenges">;
  const { deviceId } = useMe();
  const data = useQuery(api.challenges.get, { id: challengeId, deviceId });
  const join = useMutation(api.challenges.join);
  const place = useMutation(api.bets.place);
  const logProgress = useMutation(api.progress.log);
  const settle = useMutation(api.settle.now);
  const believe = useMutation(api.beliefs.toggle);
  const addPost = useMutation(api.posts.add);
  const confirmPay = useMutation(api.payments.confirm);

  const [now, setNow] = useState(Date.now());
  const [focusId, setFocusId] = useState<string | undefined>(params.p);
  const [initiated, setInitiated] = useState<string[]>([]);
  const opened = useRef(new Set<string>());
  const autoDoubt = useRef(false);
  const [target, setTarget] = useState<string | null>(null); // participant being doubted
  const [amount, setAmount] = useState("5");
  const [note, setNote] = useState("");
  const [betErr, setBetErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pay, setPay] = useState<Pay | null>(null);
  const [payState, setPayState] = useState<"idle" | "processing" | "paid">("idle");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const me = data?.participants.find((p) => p.isMe);
  const isOpen = data?.challenge.status === "open" && now < (data?.challenge.endsAt ?? 0);
  const canBetOn = (p: { isMe: boolean; paid: boolean; remainingCapCents: number }) => !!isOpen && !data?.me.participantId && !p.isMe && p.paid && p.remainingCapCents > 0;

  // Real-money challenges: open hosted checkout once the server attaches a purchaseUrl to a row I just created.
  useEffect(() => {
    if (!data || data.challenge.sandbox) return;
    for (const r of [...data.participants.filter((p) => p.isMe), ...data.myBets]) {
      if (initiated.includes(r._id) && r.purchaseUrl && !r.paid && !opened.current.has(r._id)) {
        opened.current.add(r._id);
        openCheckout(r.purchaseUrl);
      }
    }
  }, [data, initiated]);

  // In-app payment: flip to "Paid" once the row is marked paid, then close.
  useEffect(() => {
    if (!pay || payState !== "processing" || !data) return;
    const row = pay.kind === "stake" ? data.participants.find((p) => p._id === pay.rowId) : data.myBets.find((b) => b._id === pay.rowId);
    if (row?.paid) {
      setPayState("paid");
      const t = setTimeout(() => { setPay(null); setPayState("idle"); }, 1100);
      return () => clearTimeout(t);
    }
  }, [data, pay, payState]);

  // Deep link from Home "Doubt {name}": open the doubt sheet once.
  useEffect(() => {
    if (!data || autoDoubt.current || !params.doubt) return;
    autoDoubt.current = true;
    const p = data.participants.find((x) => x._id === params.doubt);
    if (p && canBetOn(p)) openDoubt(p._id, p.remainingCapCents);
  }, [data]);

  // Pedometer: every 30s while I'm a paid participant in an open steps challenge.
  const progressRef = useRef(0);
  progressRef.current = me?.progress ?? 0;
  const pedoActive = !!me?.paid && data?.challenge.status === "open" && (data?.challenge.kind ?? "steps") === "steps";
  const createdAt = data?.challenge._creationTime;
  const myId = me?._id;
  useEffect(() => {
    if (!pedoActive || !myId || !createdAt) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      try {
        const { steps } = await Pedometer.getStepCountAsync(new Date(createdAt), new Date());
        if (alive && steps > progressRef.current) await logProgress({ deviceId, participantId: myId, steps, source: "pedometer" });
      } catch {}
    };
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return;
        if (!(await Pedometer.requestPermissionsAsync()).granted) return;
        tick();
        timer = setInterval(tick, 30_000);
      } catch {}
    })();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [pedoActive, myId, createdAt]);

  function openDoubt(pid: string, capCents: number) {
    setBetErr("");
    setNote("");
    setAmount(String(Math.max(1, Math.min(5, Math.floor(capCents / 100)))));
    setFocusId(pid);
    setTarget(pid);
  }

  if (data === undefined) return <Screen><T muted>Loading…</T></Screen>;
  if (data === null) return <Screen><T muted>Challenge not found.</T></Screen>;

  const c = data.challenge;
  const steps = (c.kind ?? "steps") === "steps";
  const redirectUrl = Linking.createURL("paid");
  const paid = data.participants.filter((p) => p.paid);
  const focus =
    data.participants.find((p) => p._id === focusId) ??
    me ??
    [...paid].sort((a, b) => b.doubtCents - a.doubtCents)[0] ??
    data.participants[0];
  const frac = (p: { progress: number; verified: boolean }) => (p.verified ? 1 : steps && c.targetSteps ? Math.min(1, p.progress / c.targetSteps) : 0);
  const span = Math.max(1, c.endsAt - c._creationTime);
  const paceFrac = Math.min(1, Math.max(0, (Math.min(now, c.endsAt) - c._creationTime) / span));
  const tgt = data.participants.find((p) => p._id === target);

  const run = async (key: string, fn: () => Promise<unknown>) => {
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

  const startPay = (p: Pay) => { setPayState("idle"); setPay(p); };

  const doJoin = () => run("join", async () => {
    const pid = await join({ deviceId, challengeId, redirectUrl });
    setInitiated((x) => [...x, pid]);
    if (c.sandbox) startPay({ kind: "stake", rowId: pid, amountCents: c.stakeCents, label: `Stake · ${c.goal}` });
  });

  const doBet = async () => {
    if (!tgt) return;
    setBetErr("");
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!(amountCents > 0)) return setBetErr("Enter an amount.");
    setBusy("bet");
    try {
      const bid = await place({ deviceId, targetId: tgt._id, amountCents, note: note.trim() || undefined, redirectUrl });
      setInitiated((x) => [...x, bid]);
      setTarget(null);
      if (c.sandbox) startPay({ kind: "bet", rowId: bid, amountCents, label: `Doubt ${tgt.name} · ${c.goal}` });
    } catch (e) {
      setBetErr(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const doPay = async () => {
    if (!pay) return;
    setPayState("processing");
    try {
      await confirmPay({ deviceId, kind: pay.kind, rowId: pay.rowId });
    } catch (e) {
      setPayState("idle");
      setErr(errText(e));
    }
  };

  const share = () => {
    const url = Linking.createURL(`challenge/${c._id}`);
    Share.share({ message: `Doubt me if you dare: "${c.goal}" on Doubters. ${url}` }).catch(() => {});
  };

  const send = () => {
    const text = msg.trim();
    if (!text) return;
    setMsg("");
    addPost({ deviceId, challengeId, text, targetId: focus?._id }).catch((e) => setErr(errText(e)));
  };

  const statusLabel = (p: (typeof data.participants)[number]) =>
    !p.paid ? "Unpaid" : p.result === "finished" ? "Finished" : p.result === "quit" ? "Quit" : p.verified ? "Verified" : steps && p.progress >= c.targetSteps ? "Done" : "In";

  // Doubt-over-time bars for the focused participant.
  const BARS = 24;
  const focusBets = focus ? data.bets.filter((b) => b.targetId === focus._id) : [];
  const tEnd = Math.max(c._creationTime + 1, Math.min(now, c.endsAt));
  const bars = Array.from({ length: BARS }, (_, i) => {
    const t = c._creationTime + ((i + 1) / BARS) * (tEnd - c._creationTime);
    return Math.min(1, focusBets.filter((b) => b._creationTime <= t).reduce((s, b) => s + b.amountCents, 0) / c.stakeCents);
  });
  const lastBet = focusBets[focusBets.length - 1];
  const focusDoubters = [...new Set(focusBets.map((b) => b.bettorName))];
  const tgtDoubters = tgt ? [...new Set(data.bets.filter((b) => b.targetId === tgt._id).map((b) => b.bettorName))] : [];
  const amtCents = Math.round((parseFloat(amount) || 0) * 100);
  const isMeFocus = !!focus?.isMe;
  const who = isMeFocus ? "you" : focus?.name ?? "";

  const unpaidMine = me && !me.paid ? me : null;
  const unpaidBets = data.myBets.filter((b) => !b.paid);

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton glyph="←" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <T size={14} weight="600" numberOfLines={1} style={{ flex: 1, textAlign: "center", marginHorizontal: 8 }}>{c.goal}</T>
        <IconButton glyph="↗" label="Share" onPress={share} />
      </View>

      {/* The race */}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <T size={15} weight="600">The race</T>
          <T size={12} muted>
            {c.status === "settled" ? "Settled" : timeLeft(c.endsAt, now)}
            {steps && c.status === "open" ? ` · pace ${Math.round(c.targetSteps * paceFrac).toLocaleString()}` : ""}
          </T>
        </View>
        <View style={{ gap: 10 }}>
          {data.participants.map((p) => {
            const f = frac(p);
            const on = p._id === focus?._id;
            return (
              <Pressable key={p._id} onPress={() => setFocusId(p._id)} accessibilityLabel={`lane-${p.name}`} style={{ height: 24, justifyContent: "center" }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: K.line, overflow: "hidden" }}>
                  <View style={{ width: `${f * 100}%`, height: 4, backgroundColor: on ? K.blue : "#3A3A40" }} />
                </View>
                {c.status === "open" ? (
                  <View style={{ position: "absolute", left: `${paceFrac * 100}%`, marginLeft: -5, width: 10, height: 10, borderRadius: 5, borderWidth: 1.25, borderStyle: "dashed", borderColor: K.muted }} />
                ) : null}
                <View style={{ position: "absolute", left: `${f * 100}%`, marginLeft: f > 0.9 ? -22 : -11 }}>
                  <Avatar name={p.name} size={22} ring={p.doubtCents ? K.yellow : on ? K.blue : undefined} />
                </View>
              </Pressable>
            );
          })}
          {data.participants.length === 0 ? <T small muted>No challengers yet. Be the first.</T> : null}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: K.yellow }} />
              <T size={12} muted>doubted</T>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.25, borderStyle: "dashed", borderColor: K.muted }} />
              <T size={12} muted>on-pace ghost</T>
            </View>
          </View>
          <T size={12} muted>{steps ? "FINISH" : "PROOF"}</T>
        </View>
      </Card>

      {focus ? (
        <>
          <View style={{ gap: 6 }}>
            <T size={22} weight="600" style={{ letterSpacing: -0.4, lineHeight: 27 }}>Will {who} hit {c.goal}?</T>
            <T small muted>{money(c.stakeCents)} staked · {money(focus.pendingDoubtCents)} of {money(c.stakeCents)} doubt cap used</T>
          </View>

          <Card style={{ paddingHorizontal: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <T size={36} weight="500" color={K.yellow} style={{ letterSpacing: -1.4, lineHeight: 42 }}>{focus.doubtPct}%</T>
                <T muted>doubt</T>
              </View>
              <T small weight="500" color={K.yellow}>
                {lastBet ? `▲ ${Math.round((lastBet.amountCents / c.stakeCents) * 100)} pts · ${ago(lastBet._creationTime, now)}` : "No doubt yet"}
              </T>
            </View>
            <View style={{ height: 72, flexDirection: "row", alignItems: "flex-end", gap: 3, paddingHorizontal: 4 }}>
              {bars.map((v, i) => (
                <View key={i} style={{ flex: 1, height: Math.max(2, v * 72), borderRadius: 2, backgroundColor: K.yellow, opacity: i === BARS - 1 ? 1 : 0.35 + 0.4 * (i / BARS) }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
              <T size={11} color={K.dim}>start</T>
              <T size={11} color={K.dim}>{c.status === "settled" ? "end" : "now"}</T>
            </View>
          </Card>

          {isMeFocus ? (
            focus.paid && c.status === "open" ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button style={{ flex: 1 }} height={64} title="⌖  Check in" onPress={() => router.push({ pathname: "/checkin/[id]", params: { id: focus._id, c: challengeId } })} testID="board-checkin" />
                {steps ? (
                  <Button
                    style={{ flex: 1 }} height={64} variant="outline" title="+1,000 steps" testID="log-progress" loading={busy === "log"}
                    onPress={() => run("log", () => logProgress({ deviceId, participantId: focus._id, steps: focus.progress + 1000, source: "manual" }))}
                  />
                ) : null}
              </View>
            ) : null
          ) : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                style={{ flex: 1 }} height={64} variant="believe"
                title={focus.iBelieve ? "Believing" : "Believe · free"}
                sub={`${focus.believerCount} believe`}
                onPress={() => believe({ deviceId, participantId: focus._id }).catch((e) => setErr(errText(e)))}
              />
              <Button
                style={{ flex: 1 }} height={64} variant="doubt" title={`Doubt ${focus.name}`} testID="doubt-focus"
                sub={focus.remainingCapCents > 0 ? `up to ${money(focus.remainingCapCents)} left` : "fully doubted"}
                disabled={!canBetOn(focus)}
                onPress={() => openDoubt(focus._id, focus.remainingCapCents)}
              />
            </View>
          )}
        </>
      ) : null}

      {/* Challengers */}
      <Card style={{ gap: 4, paddingVertical: 8 }}>
        {data.participants.map((p, i) => {
          const label = statusLabel(p);
          return (
            <Pressable
              key={p._id}
              accessibilityLabel={`participant-${p.name}`}
              onPress={() => (canBetOn(p) ? openDoubt(p._id, p.remainingCapCents) : setFocusId(p._id))}
              style={({ pressed }) => ({ paddingVertical: 12, gap: 8, opacity: pressed ? 0.5 : 1, borderTopWidth: i ? 1 : 0, borderColor: K.line })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Avatar name={p.name} size={28} ring={p.doubtCents ? K.yellow : undefined} />
                <T weight="600" style={{ flex: 1 }}>{p.name}{p.isMe ? <T muted> · you</T> : null}</T>
                <T size={12} weight="600" color={K.yellow}>{p.doubtPct}% doubt</T>
                <T size={12} color={label === "Quit" ? K.red : label === "Verified" || label === "Finished" ? K.blue : K.muted} style={{ minWidth: 52, textAlign: "right" }}>{label}</T>
              </View>
              <ProgressBar value={frac(p)} thin color={p._id === focus?._id ? K.blue : K.fg} />
              <T size={12} muted>{steps ? `${p.progress.toLocaleString()} / ${c.targetSteps.toLocaleString()} steps` : p.verified ? "Proof verified" : "No proof yet"}</T>
            </Pressable>
          );
        })}
        {data.participants.length === 0 ? <T small muted style={{ paddingVertical: 12 }}>No challengers yet.</T> : null}
      </Card>

      {/* My pending payments */}
      {unpaidMine || unpaidBets.length ? (
        <Card style={{ gap: 12 }}>
          {unpaidMine ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T>Your {money(c.stakeCents)} stake</T>
              {c.sandbox ? (
                <Button title={`Pay ${money(c.stakeCents)}`} variant="text" testID="pay-stake" onPress={() => startPay({ kind: "stake", rowId: unpaidMine._id, amountCents: c.stakeCents, label: `Stake · ${c.goal}` })} />
              ) : unpaidMine.purchaseUrl ? (
                <Button title={`Pay ${money(c.stakeCents)}`} variant="text" testID="pay-stake" onPress={() => openCheckout(unpaidMine.purchaseUrl!)} />
              ) : (
                <T small muted>Preparing checkout…</T>
              )}
            </View>
          ) : null}
          {unpaidBets.map((b) => {
            const t = data.participants.find((p) => p._id === b.targetId);
            return (
              <View key={b._id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T>{money(b.amountCents)} doubt on {t?.name ?? "—"}</T>
                {c.sandbox ? (
                  <Button title="Pay" variant="text" testID="pay-bet" onPress={() => startPay({ kind: "bet", rowId: b._id, amountCents: b.amountCents, label: `Doubt ${t?.name ?? ""} · ${c.goal}` })} />
                ) : b.purchaseUrl ? (
                  <Button title="Pay" variant="text" testID="pay-bet" onPress={() => openCheckout(b.purchaseUrl!)} />
                ) : (
                  <T small muted>Preparing checkout…</T>
                )}
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* Trash talk */}
      <Card style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <T size={15} weight="600">Trash talk</T>
          <T size={12} muted>{data.posts.length} {data.posts.length === 1 ? "post" : "posts"}</T>
        </View>
        {data.posts.length === 0 ? <T small muted>Quiet so far. Say something.</T> : null}
        {data.posts.map((p) => {
          const t = ago(p._creationTime, now);
          const line = (dot: string, body: string, extra?: string) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
              <T small muted style={{ flex: 1 }}><T small weight="600">{p.authorName}</T> {body}</T>
              {extra ? <T size={12} color={extra === "Verified" ? K.blue : K.muted} weight="600">{extra}</T> : null}
              <T size={12} muted>{t}</T>
            </View>
          );
          const bubble = p.text ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Avatar name={p.authorName} />
              <View style={{ flex: 1, gap: 4 }}>
                <T small muted><T small weight="600">{p.authorName}</T> · {t}</T>
                <T style={{ lineHeight: 20 }}>{p.text}</T>
              </View>
            </View>
          ) : null;
          if (p.type === "comment") return <View key={p._id}>{bubble}</View>;
          const body =
            p.type === "doubt" ? `doubted ${p.targetName ?? ""} · ${money(p.amountCents ?? 0)}`
            : p.type === "believe" ? `believes in ${p.targetName ?? ""}`
            : p.type === "join" ? `joined · ${money(c.stakeCents)} staked`
            : p.type === "finish" ? `finished${steps ? ` · ${c.targetSteps.toLocaleString()} steps` : ""}`
            : p.type === "proof" ? `posted ${p.proofKind ?? "photo"} proof`
            : `checked in${p.activity ? ` · ${p.activity}` : ""}`;
          const dot = p.type === "doubt" ? K.yellow : p.type === "believe" || p.type === "finish" ? K.blue : K.fg;
          const extra = p.type === "proof" ? (p.status === "approved" ? "Verified" : "In review") : undefined;
          return (
            <View key={p._id} style={{ gap: 12 }}>
              {line(dot, body, extra)}
              {bubble}
            </View>
          );
        })}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderRadius: 24, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, paddingLeft: 16, paddingRight: 6 }}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            onSubmitEditing={send}
            placeholder={`Say something to ${isMeFocus ? "your doubters" : focus?.name ?? "the group"}`}
            placeholderTextColor={K.dim}
            accessibilityLabel="Message"
            style={{ flex: 1, color: K.fg, fontSize: 15 }}
          />
          <Pressable accessibilityLabel="Send" onPress={send} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: K.fg, alignItems: "center", justifyContent: "center" }}>
            <T color={K.bg} weight="700">↑</T>
          </Pressable>
        </View>
      </Card>

      {err ? <T small red testID="board-error">{err}</T> : null}

      <View style={{ gap: 12 }}>
        {isOpen && !data.me.participantId && !data.me.hasBets ? (
          <Button title={`Join · ${money(c.stakeCents)}`} onPress={doJoin} loading={busy === "join"} testID="join-button" />
        ) : null}
        {c.status === "settled" ? (
          <Button title="View results" onPress={() => router.push({ pathname: "/results/[id]", params: { id: c._id } })} testID="view-results" />
        ) : null}
        {c.status === "open" ? (
          <Button title="Settle now" variant="outline" height={44} onPress={() => run("settle", () => settle({ deviceId, challengeId }))} loading={busy === "settle"} testID="settle-now" />
        ) : null}
        {c.status === "settling" ? <T muted style={{ textAlign: "center" }}>Settling…</T> : null}
      </View>

      {/* Doubt a friend */}
      <Sheet visible={!!tgt} onClose={() => setTarget(null)}>
        {tgt ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Avatar name={tgt.name} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={24} weight="600" style={{ letterSpacing: -0.4, lineHeight: 29 }}>Doubt {tgt.name}</T>
                <T muted numberOfLines={2}>
                  {steps ? `${tgt.progress.toLocaleString()} of ${c.targetSteps.toLocaleString()}` : tgt.verified ? "Proof verified" : "No proof yet"}
                  {tgtDoubters.length ? ` · ${tgtDoubters.slice(0, 2).join(", ")}${tgtDoubters.length > 2 ? ` + ${tgtDoubters.length - 2}` : ""} already doubt` : " · be the first to doubt"}
                </T>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CHIPS.map((d) => (
                  <Chip key={d} label={`$${d}`} color={K.yellow} active={amtCents === d * 100} disabled={d * 100 > tgt.remainingCapCents} onPress={() => setAmount(String(d))} />
                ))}
              </View>
              <Input label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Custom" testID="bet-amount" />
              <T small muted>
                {money(tgt.remainingCapCents)} of doubt left. Doubts can't add up to more than {tgt.name}'s {money(c.stakeCents)} stake.
              </T>
            </View>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, paddingHorizontal: 16, paddingVertical: 4 }}>
              {[
                [`If ${tgt.name} quits`, `you get ${money(amtCents + Math.floor(amtCents * 0.95))}`, K.yellow],
                [`If ${tgt.name} finishes`, `they keep ${money(amtCents)}`, K.fg],
                ["Doubt after you", `${tgt.doubtPct}% → ${Math.min(100, Math.round(((tgt.doubtCents + amtCents) / c.stakeCents) * 100))}%`, K.fg],
              ].map(([l, r, col], i) => (
                <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: K.line }}>
                  <T muted size={14}>{l}</T>
                  <T weight={i === 0 ? "600" : "400"} color={col}>{r}</T>
                </View>
              ))}
            </View>
            <Input label={`Tell ${tgt.name} why (posts to the thread)`} value={note} onChangeText={setNote} placeholder="see you at 4k, buddy" testID="bet-note" />
            {betErr ? <T small red testID="bet-error">{betErr}</T> : null}
            <View style={{ gap: 10, alignItems: "center" }}>
              <Button style={{ alignSelf: "stretch" }} height={56} variant="doubt" title={`Doubt ${tgt.name} · ${money(amtCents)}`} onPress={doBet} loading={busy === "bet"} testID="bet-submit" />
              <T size={12} muted>Paid with Whop · 5% fee on winnings only</T>
            </View>
          </>
        ) : null}
      </Sheet>

      {/* In-app payment */}
      <Sheet visible={!!pay} onClose={() => payState !== "processing" && setPay(null)}>
        {pay ? (
          <>
            <View style={{ alignItems: "center", gap: 6, paddingTop: 4 }}>
              <T small muted>Doubters</T>
              <T size={44} weight="500" style={{ letterSpacing: -1.6, lineHeight: 50 }}>{money(pay.amountCents)}</T>
              <T muted numberOfLines={2} style={{ textAlign: "center" }}>{pay.label}</T>
            </View>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, paddingHorizontal: 16, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 }}>
                <T muted size={14}>{pay.kind === "stake" ? "Stake" : "Doubt"}</T>
                <T>{money(pay.amountCents)}</T>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderColor: K.line }}>
                <T muted size={14}>Total</T>
                <T weight="600">{money(pay.amountCents)}</T>
              </View>
            </View>
            {payState === "paid" ? (
              <View style={{ height: 56, borderRadius: 14, backgroundColor: K.blue, alignItems: "center", justifyContent: "center" }}>
                <T color={K.bg} weight="600" size={16}>✓  Paid</T>
              </View>
            ) : (
              <Button
                height={56}
                title={payState === "processing" ? "Processing…" : `Pay ${money(pay.amountCents)}`}
                loading={payState === "processing"}
                onPress={doPay}
                testID="pay-confirm"
              />
            )}
            <T size={12} muted style={{ textAlign: "center" }}>Paid with Whop · 5% fee on winnings only</T>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
