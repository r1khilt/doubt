import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { Pedometer } from "expo-sensors";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Share, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T as K, avatarColor } from "@/theme";
import { Avatar, AvatarStack, Chip, Icon, IconButton, Input, Screen, Sheet, T, ago, clock, errText, money } from "@/ui";

const openCheckout = (url: string) => WebBrowser.openAuthSessionAsync(url, Linking.createURL("paid")).catch(() => {});
const CHIPS = [2, 5, 10, 20];
const FONT = Platform.OS === "web" ? "-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', sans-serif" : undefined;
type Pay = { kind: "stake" | "bet"; rowId: string; amountCents: number; label: string };

const fewNames = (names: string[], count: number) => `${names.slice(0, 2).join(", ")}${count > 2 ? ` + ${count - 2}` : ""}`;
const hm = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
const hourLabel = (ts: number) => {
  const d = new Date(ts);
  const h = d.getHours() + (d.getMinutes() >= 30 ? 1 : 0);
  return `${h % 12 || 12} ${h % 24 < 12 ? "AM" : "PM"}`;
};

// ── Oval race track (stadium), geometry copied from the design's 318x206 SVG ──
const CX1 = 94, CX2 = 224, CY = 95, STRAIGHT = 130;
const perim = (r: number) => 2 * STRAIGHT + 2 * Math.PI * r;
function pointAt(r: number, f: number): [number, number] {
  let d = Math.max(0, Math.min(1, f)) * perim(r);
  const arc = Math.PI * r;
  if (d <= 65) return [159 + d, CY + r];
  d -= 65;
  if (d <= arc) return [CX2 + r * Math.sin(d / r), CY + r * Math.cos(d / r)];
  d -= arc;
  if (d <= STRAIGHT) return [CX2 - d, CY - r];
  d -= STRAIGHT;
  if (d <= arc) return [CX1 - r * Math.sin(d / r), CY - r * Math.cos(d / r)];
  d -= arc;
  return [CX1 + d, CY + r];
}
function pathTo(r: number, f: number) {
  let d = Math.max(0, Math.min(1, f)) * perim(r);
  const arc = Math.PI * r;
  const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  let out = `M159,${CY + r}`;
  const s1 = Math.min(d, 65); out += ` L${p(159 + s1, CY + r)}`; d -= s1;
  if (d <= 0) return out;
  const a1 = Math.min(d, arc); out += ` A${r},${r} 0 0 0 ${p(CX2 + r * Math.sin(a1 / r), CY + r * Math.cos(a1 / r))}`; d -= a1;
  if (d <= 0) return out;
  const s2 = Math.min(d, STRAIGHT); out += ` L${p(CX2 - s2, CY - r)}`; d -= s2;
  if (d <= 0) return out;
  const a2 = Math.min(d, arc); out += ` A${r},${r} 0 0 0 ${p(CX1 - r * Math.sin(a2 / r), CY - r * Math.cos(a2 / r))}`; d -= a2;
  if (d <= 0) return out;
  return out + ` L${p(CX1 + Math.min(d, 65), CY + r)}`;
}
const stadium = (r: number) => `M94,${CY - r} L224,${CY - r} A${r},${r} 0 0 1 224,${CY + r} L94,${CY + r} A${r},${r} 0 0 1 94,${CY - r} Z`;

type Runner = { id: string; name: string; isMe: boolean; frac: number; finished: boolean; doubters: number; focus: boolean; label: string };
function RaceTrack({ runners, pace, center, sub, finishedLabel }: { runners: Runner[]; pace: number | null; center: string; sub: string; finishedLabel?: string }) {
  const racing = runners.filter((r) => !r.finished);
  const done = runners.filter((r) => r.finished);
  const others = [56, 80, 74, 62];
  let oi = 0;
  const lane = (r: Runner) => (r.isMe ? 68 : others[oi++ % others.length]);
  const placed = racing.map((r) => ({ ...r, r: lane(r) }));
  const meLane = placed.find((p) => p.isMe) ?? placed.find((p) => p.focus);
  return (
    <View style={{ width: "100%", aspectRatio: 318 / 206 }}>
      <Svg width="100%" height="100%" viewBox="0 0 318 206" fill="none">
        <Path d={stadium(86)} fill="#202024" />
        <Path d={stadium(50)} fill="#17171A" />
        <Path d={stadium(86)} stroke="#4A4A50" strokeWidth={1.5} />
        <Path d={stadium(50)} stroke="#4A4A50" strokeWidth={1.5} />
        <Path d={stadium(62)} stroke="#3A3A40" strokeWidth={1} strokeDasharray="5 5" />
        <Path d={stadium(74)} stroke="#3A3A40" strokeWidth={1} strokeDasharray="5 5" />
        {[0, 1, 2, 3, 4, 5].map((i) => [
          <Rect key={`a${i}`} x={153} y={145 + i * 6} width={6} height={6} fill={i % 2 ? "#0B0B0C" : "#F2F2F0"} />,
          <Rect key={`b${i}`} x={159} y={145 + i * 6} width={6} height={6} fill={i % 2 ? "#F2F2F0" : "#0B0B0C"} />,
        ])}
        <SvgText fontFamily={FONT} x={159} y={200} fontSize={9} fontWeight="600" letterSpacing={1.5} fill="#9A9AA0" textAnchor="middle">START / FINISH</SvgText>
        {placed.map((p) => {
          return p.frac > 0.002 ? <Path key={`p${p.id}`} d={pathTo(p.r, p.frac)} stroke={p.isMe ? K.blue : avatarColor(p.name)} strokeWidth={3} strokeLinecap="round" /> : null;
        })}
        {pace !== null && meLane ? (() => {
          const [x, y] = pointAt(meLane.r, pace);
          return <Circle cx={x} cy={y} r={9} stroke="#9A9AA0" strokeWidth={1.25} strokeDasharray="2 2" />;
        })() : null}
        {placed.map((p) => {
          const [x, y] = pointAt(p.r, p.frac);
          return [
            <Circle key={`c${p.id}`} cx={x} cy={y} r={p.isMe ? 12 : 11} fill={p.isMe ? K.blue : avatarColor(p.name)} stroke="#17171A" strokeWidth={2} />,
            <SvgText fontFamily={FONT} key={`t${p.id}`} x={x} y={y + 3.8} fontSize={10} fontWeight="600" fill={p.isMe ? "#0B0B0C" : "#F2F2F0"} textAnchor="middle">{(p.name[0] ?? "?").toUpperCase()}</SvgText>,
          ];
        })}
        {done.map((p, i) => [
          <Circle key={`d${p.id}`} cx={185 + i * 24} cy={175} r={11} fill={avatarColor(p.name)} stroke="#6CB4FF" strokeWidth={2} />,
          <SvgText fontFamily={FONT} key={`dt${p.id}`} x={185 + i * 24} y={178.8} fontSize={10} fontWeight="600" fill="#F2F2F0" textAnchor="middle">{(p.name[0] ?? "?").toUpperCase()}</SvgText>,
        ])}
        {placed.map((p) => {
          const [lx, ly] = pointAt(36, p.frac);
          const end = lx > 159;
          const dots = Math.min(8, p.doubters);
          return [
            <SvgText fontFamily={FONT} key={`l${p.id}`} x={lx} y={ly + 3} fontSize={11} fontWeight={p.isMe ? "600" : "400"} fill={p.isMe ? K.blue : "#F2F2F0"} textAnchor={end ? "end" : "start"}>
              {`${p.isMe ? "You" : p.name} · ${p.label}`}
            </SvgText>,
            ...Array.from({ length: dots }, (_, i) => (
              <Circle key={`dot${p.id}${i}`} cx={end ? lx - 7 * (dots - 1 - i) : lx + 3 + 7 * i} cy={ly + 12} r={2.5} fill={K.yellow} />
            )),
          ];
        })}
        <SvgText fontFamily={FONT} x={159} y={92} fontSize={18} fontWeight="500" fill="#F2F2F0" textAnchor="middle">{center}</SvgText>
        <SvgText fontFamily={FONT} x={159} y={106} fontSize={10} fill="#9A9AA0" textAnchor="middle">{sub}</SvgText>
        {finishedLabel ? <SvgText fontFamily={FONT} x={180} y={138} fontSize={10} fill="#9A9AA0" textAnchor="middle">{finishedLabel}</SvgText> : null}
      </Svg>
    </View>
  );
}

// ── Doubt-over-time line chart (330x150 viewBox, like the design) ──
function DoubtChart({ series, labels }: { series: number[]; labels: string[] }) {
  const n = series.length;
  const pts = series.map((v, i) => [(i * 318) / (n - 1), 130 - Math.max(0, Math.min(1, v)) * 130] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[n - 1];
  return (
    <View style={{ width: "100%", aspectRatio: 330 / 150 }}>
      <Svg width="100%" height="100%" viewBox="0 0 330 150" fill="none">
        <Line x1={0} y1={2} x2={318} y2={2} stroke="#2A2A2E" strokeDasharray="3 4" />
        <Line x1={0} y1={65} x2={318} y2={65} stroke="#2A2A2E" strokeDasharray="3 4" />
        <Line x1={0} y1={130} x2={318} y2={130} stroke="#2A2A2E" />
        <SvgText fontFamily={FONT} x={0} y={14} fontSize={10} fill="#9A9AA0">100%</SvgText>
        <SvgText fontFamily={FONT} x={0} y={77} fontSize={10} fill="#9A9AA0">50%</SvgText>
        <Path d={`M${line.split(" ").join(" L")} L318,130 L0,130 Z`} fill="#F2E14C" fillOpacity={0.1} />
        <Polyline points={line} stroke="#F2E14C" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={lx} cy={ly} r={4} fill="#F2E14C" />
        <SvgText fontFamily={FONT} x={0} y={146} fontSize={10} fill="#9A9AA0">{labels[0]}</SvgText>
        <SvgText fontFamily={FONT} x={106} y={146} fontSize={10} fill="#9A9AA0" textAnchor="middle">{labels[1]}</SvgText>
        <SvgText fontFamily={FONT} x={212} y={146} fontSize={10} fill="#9A9AA0" textAnchor="middle">{labels[2]}</SvgText>
        <SvgText fontFamily={FONT} x={318} y={146} fontSize={10} fill="#9A9AA0" textAnchor="end">{labels[3]}</SvgText>
      </Svg>
    </View>
  );
}

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
  const [target, setTarget] = useState<string | null>(null);
  const [amount, setAmount] = useState("5");
  const [note, setNote] = useState("");
  const [betErr, setBetErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pay, setPay] = useState<Pay | null>(null);
  const [payState, setPayState] = useState<"idle" | "processing" | "paid">("idle");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const me = data?.participants.find((p) => p.isMe);
  const isOpen = data?.challenge.status === "open" && now < (data?.challenge.endsAt ?? 0);
  const canBetOn = (p: { isMe: boolean; paid: boolean; remainingCapCents: number; result: string }) =>
    !!isOpen && !p.isMe && p.paid && p.result === "pending" && p.remainingCapCents > 0;

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
  const pedoActive = !!me?.paid && data?.challenge.status === "open" && data?.challenge.kind === "steps";
  const startedAt = data?.challenge.startedAt;
  const myId = me?._id;
  useEffect(() => {
    if (!pedoActive || !myId || !startedAt) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      try {
        const { steps } = await Pedometer.getStepCountAsync(new Date(Math.max(startedAt, Date.now() - 7 * 86_400_000)), new Date());
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
  }, [pedoActive, myId, startedAt]);

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
  const steps = c.kind === "steps";
  const redirectUrl = Linking.createURL("paid");
  const paid = data.participants.filter((p) => p.paid);
  const isFinished = (p: { progress: number; verified: boolean; result: string }) =>
    p.result === "finished" || p.verified || (steps && c.targetSteps > 0 && p.progress >= c.targetSteps);
  const focus =
    data.participants.find((p) => p._id === focusId) ??
    [...paid].filter((p) => !p.isMe && !isFinished(p)).sort((a, b) => b.doubtPct - a.doubtPct)[0] ??
    me ??
    data.participants[0];
  const span = Math.max(1, c.endsAt - c.startedAt);
  const paceFrac = Math.min(1, Math.max(0, (Math.min(now, c.endsAt) - c.startedAt) / span));
  const frac = (p: { progress: number; verified: boolean }) =>
    p.verified ? 1 : steps ? (c.targetSteps ? Math.min(1, p.progress / c.targetSteps) : 0) : paceFrac;
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

  // Race runners (paid participants).
  const finishPost = (name: string) => data.posts.find((p) => p.type === "finish" && p.authorName === name);
  const runners = paid.map((p) => ({
    id: p._id, name: p.name, isMe: p.isMe, frac: frac(p), finished: isFinished(p), doubters: p.doubterCount, focus: p._id === focus?._id,
    label: p.verified && !steps ? "verified" : steps ? p.progress.toLocaleString() : "in",
  }));
  const firstDone = paid.find((p) => isFinished(p) && !p.isMe);
  const fp = firstDone ? finishPost(firstDone.name) : undefined;
  const finishedLabel = firstDone ? `${firstDone.name} finished${fp ? ` ${clock(fp._creationTime)}` : ""}` : undefined;
  const lapLabel = steps ? `left · 1 lap = ${c.targetSteps >= 1000 ? `${Math.round(c.targetSteps / 100) / 10}k` : c.targetSteps} steps` : `left · ends ${clock(c.endsAt)}`;

  // Count-based doubt % over time for the focused participant (doubters / (doubters + believers)).
  // Believer timestamps aren't tracked, so believers count as constant and doubters accumulate as they arrive.
  const N = 12;
  const tEnd = Math.max(c.startedAt + 1, Math.min(now, c.endsAt));
  const doubtEvents = focus ? data.bets.filter((b) => b.targetId === focus._id) : [];
  const believeEvents = focus ? data.posts.filter((p) => p.type === "believe" && p.targetId === focus._id) : [];
  const t0 = Math.min(tEnd - 60_000, Math.max(c.startedAt, doubtEvents[0]?._creationTime ?? c.startedAt));
  const B = focus?.believerCount ?? 0;
  const series = Array.from({ length: N }, (_, i) => {
    if (i === N - 1) return (focus?.doubtPct ?? 0) / 100;
    const t = t0 + (i / (N - 1)) * (tEnd - t0);
    const d = new Set(doubtEvents.filter((b) => b._creationTime <= t).map((b) => b.bettorName)).size;
    return d + B ? d / (d + B) : 0;
  });
  const labels = [0, 1, 2].map((k) => hourLabel(t0 + (k / 3) * (tEnd - t0))).concat(c.status === "settled" ? "End" : "Now");
  const delta = Math.round((series[N - 1] - series[0]) * 100);
  const since = labels[0] === "12 PM" ? "noon" : labels[0];

  const believerNames = focus ? [...new Set(believeEvents.map((p) => p.authorName))] : [];
  const tgtBets = tgt ? data.bets.filter((b) => b.targetId === tgt._id) : [];
  const tgtDoubters = [...new Map([...tgtBets].sort((a, b) => b.amountCents - a.amountCents).map((b) => [b.bettorName, b])).keys()];
  const amtCents = Math.round((parseFloat(amount) || 0) * 100);
  const alreadyDoubt = !!tgt && data.myBets.some((b) => b.targetId === tgt._id);
  const afterPct = tgt
    ? alreadyDoubt ? tgt.doubtPct : Math.round(((tgt.doubterCount + 1) / (tgt.doubterCount + 1 + tgt.believerCount)) * 100)
    : 0;
  const isMeFocus = !!focus?.isMe;

  // Thread for the focused person: recent conversation oldest→newest, then earlier activity.
  const relevant = focus ? data.posts.filter((p) => p.targetId === focus._id || p.type === "finish" || (!p.targetId && p.type !== "join")) : data.posts;
  const RECENT = 15 * 60_000;
  const recent = relevant.filter((p) => now - p._creationTime < RECENT).slice(0, 4).reverse();
  const earlier = relevant.filter((p) => now - p._creationTime >= RECENT && ["finish", "believe", "checkin", "proof"].includes(p.type));
  const thread = [...recent, ...earlier].slice(0, 6);
  const replies = focus ? data.posts.filter((p) => p.targetId === focus._id).length : data.posts.length;

  const unpaidMine = me && !me.paid ? me : null;
  const unpaidBets = data.myBets.filter((b) => !b.paid);

  return (
    <Screen top={56} bottom={40} gap={20}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <T size={14} weight="600" numberOfLines={1} style={{ flex: 1, textAlign: "center", marginHorizontal: 8 }}>{c.goal}</T>
        <IconButton icon="share" label="Share challenge" onPress={share} />
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <T size={15} weight="600">The race</T>
          <T size={12} muted>
            {c.status === "settled" ? "Settled" : `${hm(c.endsAt - now)} left`}
            {steps && c.status === "open" ? ` · pace ${Math.round(c.targetSteps * paceFrac).toLocaleString()}` : ""}
          </T>
        </View>
        <RaceTrack
          runners={runners}
          pace={steps && c.status === "open" ? paceFrac : null}
          center={c.status === "settled" ? "Done" : hm(c.endsAt - now)}
          sub={c.status === "settled" ? "settled" : lapLabel}
          finishedLabel={finishedLabel}
        />
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: K.yellow }} />
            <T size={12} muted>doubter</T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.25, borderStyle: "dashed", borderColor: K.muted }} />
            <T size={12} muted>on-pace ghost</T>
          </View>
        </View>
      </View>

      {focus ? (
        <>
          <View style={{ gap: 6 }}>
            <T size={22} weight="600" lh={1.2} style={{ letterSpacing: -0.44 }}>Will {isMeFocus ? "you" : focus.name} hit {c.goal}?</T>
            <T size={13} muted>{money(c.stakeCents)} staked · {money(focus.pendingDoubtCents)} of {money(c.stakeCents)} doubt cap used</T>
          </View>

          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, paddingTop: 16, paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <T size={36} weight="500" lh={1.15} color={K.yellow} style={{ letterSpacing: -1.44 }}>{focus.doubtPct}%</T>
                <T size={14} muted>doubt</T>
              </View>
              <T size={13} weight="500" color={K.yellow}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts since {since}</T>
            </View>
            <DoubtChart series={series} labels={labels} />
          </View>

          {isMeFocus ? (
            focus.paid && c.status === "open" ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  testID="board-checkin"
                  accessibilityLabel="Check in"
                  onPress={() => router.push({ pathname: "/checkin/[id]", params: { id: focus._id, c: c._id } })}
                  style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: 14, backgroundColor: K.fg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="pin" size={18} color={K.bg} />
                  <T size={15} weight="600" color={K.bg}>Check in</T>
                </Pressable>
                {steps ? (
                  <Pressable
                    testID="log-progress"
                    accessibilityLabel="+1,000 steps"
                    disabled={busy === "log"}
                    onPress={() => run("log", () => logProgress({ deviceId, participantId: focus._id, steps: focus.progress + 1000, source: "manual" }))}
                    style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: 14, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, alignItems: "center", justifyContent: "center", opacity: pressed || busy === "log" ? 0.6 : 1 })}
                  >
                    <T size={15} weight="600">+1,000 steps</T>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          ) : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                accessibilityLabel={`Believe in ${focus.name}`}
                onPress={() => believe({ deviceId, participantId: focus._id }).catch((e) => setErr(errText(e)))}
                style={({ pressed }) => ({
                  flex: 1, height: 64, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.7 : 1,
                  ...(focus.iBelieve ? { backgroundColor: K.blue } : { borderWidth: 1, borderColor: K.blue, backgroundColor: K.card }),
                })}
              >
                <T size={15} weight="600" color={focus.iBelieve ? K.bg : K.blue}>{focus.iBelieve ? "Believing" : "Believe · free"}</T>
                {believerNames.length ? <AvatarStack names={believerNames} size={20} max={4} /> : <T size={12} weight="500" color={focus.iBelieve ? K.bg : K.blue}>{focus.believerCount} believe</T>}
              </Pressable>
              <Pressable
                testID="doubt-focus"
                accessibilityLabel={`Doubt ${focus.name}`}
                disabled={!canBetOn(focus)}
                onPress={() => openDoubt(focus._id, focus.remainingCapCents)}
                style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: 14, backgroundColor: K.yellow, alignItems: "center", justifyContent: "center", gap: 4, opacity: !canBetOn(focus) ? 0.45 : pressed ? 0.7 : 1 })}
              >
                <T size={15} weight="600" color={K.bg}>Doubt {focus.name}</T>
                <T size={12} weight="500" color={K.bg}>{focus.remainingCapCents > 0 ? `up to ${money(focus.remainingCapCents)} left` : "fully doubted"}</T>
              </Pressable>
            </View>
          )}
        </>
      ) : null}

      {/* Trash talk */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <T size={15} weight="600">Trash talk</T>
          <T size={12} muted>{replies} {replies === 1 ? "reply" : "replies"}</T>
        </View>
        {thread.length === 0 ? <T size={13} muted>Quiet so far. Say something.</T> : null}
        {thread.map((p) => {
          const t = ago(p._creationTime, now);
          const bubble = p.text ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Avatar name={p.authorName} size={32} />
              <View style={{ flex: 1, gap: 4 }}>
                <T size={13} muted><T size={13} weight="600">{p.authorName}</T> · {t}</T>
                <T size={15} lh={1.35}>{p.text}</T>
                <T size={12} muted>Reply</T>
              </View>
            </View>
          ) : null;
          if (p.type === "comment") return <View key={p._id}>{bubble}</View>;
          const target = p.targetName ?? "";
          const body =
            p.type === "doubt" ? `doubted ${target} · ${money(p.amountCents ?? 0)}`
            : p.type === "believe" ? `believes in ${target}`
            : p.type === "join" ? `joined · ${money(c.stakeCents)} staked`
            : p.type === "finish" ? `finished${steps ? ` · ${c.targetSteps.toLocaleString()} steps` : ""}`
            : p.type === "proof" ? `posted ${p.proofKind ?? "photo"} proof`
            : `checked in${p.place ? ` · ${p.place}` : p.activity ? ` · ${p.activity}` : ""}`;
          const icon =
            p.type === "doubt" ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: K.yellow }} />
            : p.type === "finish" ? <Icon name="flag" size={14} color={K.blue} />
            : p.type === "believe" ? <Icon name="thumb" size={14} color={K.blue} />
            : p.type === "join" ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: K.muted }} />
            : <Icon name="pin" size={14} color={K.muted} />;
          const extra = p.type === "proof" ? (p.status === "approved" ? "Verified" : "In review") : null;
          return (
            <View key={p._id} style={{ gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {icon}
                <T size={13} muted style={{ flex: 1 }}><T size={13} weight="600">{p.authorName}</T> {body}</T>
                {extra ? <T size={12} weight="600" color={extra === "Verified" ? K.blue : K.muted}>{extra}</T> : null}
                <T size={12} muted>{t}</T>
              </View>
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
            style={{ flex: 1, minWidth: 0, color: K.fg, fontSize: 15 }}
          />
          <Pressable accessibilityLabel="Send" onPress={send} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: K.fg, alignItems: "center", justifyContent: "center" }}>
            <Icon name="up" size={16} color={K.bg} width={2.25} />
          </Pressable>
        </View>
      </View>

      {/* Everyone in the race (switch focus) */}
      {data.participants.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {data.participants.map((p) => (
            <Pressable key={p._id} accessibilityLabel={`participant-${p.name}`} onPress={() => setFocusId(p._id)} style={{ alignItems: "center", gap: 6, opacity: p._id === focus?._id ? 1 : 0.55 }}>
              <Avatar name={p.name} size={36} ring={p._id === focus?._id ? K.blue : undefined} fill={p.isMe ? K.blue : undefined} textColor={p.isMe ? K.bg : K.fg} />
              <T size={12} muted>{p.isMe ? "You" : p.name}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* My pending payments */}
      {unpaidMine || unpaidBets.length ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: K.line, backgroundColor: K.card, padding: 16, gap: 12 }}>
          {unpaidMine ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T>Your {money(c.stakeCents)} stake</T>
              {c.sandbox ? (
                <Pressable testID="pay-stake" onPress={() => startPay({ kind: "stake", rowId: unpaidMine._id, amountCents: c.stakeCents, label: `Stake · ${c.goal}` })}>
                  <T weight="600" color={K.blue}>Pay {money(c.stakeCents)}</T>
                </Pressable>
              ) : unpaidMine.purchaseUrl ? (
                <Pressable testID="pay-stake" onPress={() => openCheckout(unpaidMine.purchaseUrl!)}>
                  <T weight="600" color={K.blue}>Pay {money(c.stakeCents)}</T>
                </Pressable>
              ) : (
                <T size={13} muted>Preparing checkout…</T>
              )}
            </View>
          ) : null}
          {unpaidBets.map((b) => {
            const t = data.participants.find((p) => p._id === b.targetId);
            return (
              <View key={b._id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T>{money(b.amountCents)} doubt on {t?.name ?? "—"}</T>
                {c.sandbox ? (
                  <Pressable testID="pay-bet" onPress={() => startPay({ kind: "bet", rowId: b._id, amountCents: b.amountCents, label: `Doubt ${t?.name ?? ""} · ${c.goal}` })}>
                    <T weight="600" color={K.blue}>Pay</T>
                  </Pressable>
                ) : b.purchaseUrl ? (
                  <Pressable testID="pay-bet" onPress={() => openCheckout(b.purchaseUrl!)}>
                    <T weight="600" color={K.blue}>Pay</T>
                  </Pressable>
                ) : (
                  <T size={13} muted>Preparing checkout…</T>
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {err ? <T size={13} red testID="board-error">{err}</T> : null}

      <View style={{ gap: 12 }}>
        {isOpen && !data.me.participantId ? (
          <Pressable
            testID="join-button"
            accessibilityLabel={`Join · ${money(c.stakeCents)}`}
            disabled={busy === "join"}
            onPress={doJoin}
            style={({ pressed }) => ({ height: 52, borderRadius: 14, backgroundColor: K.fg, alignItems: "center", justifyContent: "center", opacity: pressed || busy === "join" ? 0.6 : 1 })}
          >
            <T size={15} weight="600" color={K.bg}>Join · {money(c.stakeCents)}</T>
          </Pressable>
        ) : null}
        {c.status === "settled" ? (
          <Pressable
            testID="view-results"
            accessibilityLabel="View results"
            onPress={() => router.push({ pathname: "/results/[id]", params: { id: c._id } })}
            style={({ pressed }) => ({ height: 52, borderRadius: 14, backgroundColor: K.fg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <T size={15} weight="600" color={K.bg}>View results</T>
          </Pressable>
        ) : null}
        {c.status === "open" ? (
          <Pressable
            testID="settle-now"
            accessibilityLabel="Settle now"
            disabled={busy === "settle"}
            onPress={() => run("settle", () => settle({ deviceId, challengeId }))}
            style={({ pressed }) => ({ height: 44, borderRadius: 12, borderWidth: 1, borderColor: K.line, alignItems: "center", justifyContent: "center", opacity: pressed || busy === "settle" ? 0.6 : 1 })}
          >
            <T size={14} weight="600" color={K.muted}>Settle now</T>
          </Pressable>
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
                <T size={24} weight="600" lh={1.2} style={{ letterSpacing: -0.48 }}>Doubt {tgt.name}</T>
                <T size={14} muted numberOfLines={2}>
                  {steps ? `${tgt.progress.toLocaleString()} of ${c.targetSteps.toLocaleString()}` : tgt.verified ? "Proof verified" : "No proof yet"}
                  {tgt.doubterCount ? ` · ${fewNames(tgtDoubters, tgt.doubterCount)} already doubt` : " · be the first to doubt"}
                </T>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CHIPS.map((d) => (
                  <Chip key={d} label={`$${d}`} color={K.yellow} active={amtCents === d * 100} disabled={d * 100 > tgt.remainingCapCents} onPress={() => setAmount(String(d))} />
                ))}
              </View>
              <T size={13} muted>{money(tgt.remainingCapCents)} of doubt left. Doubts can't add up to more than {tgt.name}'s {money(c.stakeCents)} stake.</T>
              <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Other amount" testID="bet-amount" accessibilityLabel="Amount ($)" />
            </View>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, paddingHorizontal: 16, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: K.line }}>
                <T size={14} muted>If {tgt.name} quits</T>
                <T size={15} weight="600" color={K.yellow}>you get {money(amtCents + Math.floor(amtCents * 0.95))}</T>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: K.line }}>
                <T size={14} muted>If {tgt.name} finishes</T>
                <T size={15}>they keep {money(amtCents)}</T>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 }}>
                <T size={14} muted>Doubt after you</T>
                <T size={15}>{tgt.doubtPct}% → <T size={15} weight="600" color={K.yellow}>{afterPct}%</T></T>
              </View>
            </View>
            <Input label="Tell them why (posts to the thread)" value={note} onChangeText={setNote} placeholder="see you at 4k, buddy" testID="bet-note" />
            {betErr ? <T size={13} red testID="bet-error">{betErr}</T> : null}
            <View style={{ gap: 10, alignItems: "center" }}>
              <Pressable
                testID="bet-submit"
                accessibilityLabel={`Doubt ${tgt.name} · ${money(amtCents)}`}
                disabled={busy === "bet"}
                onPress={doBet}
                style={({ pressed }) => ({ alignSelf: "stretch", height: 56, borderRadius: 14, backgroundColor: K.yellow, alignItems: "center", justifyContent: "center", opacity: pressed || busy === "bet" ? 0.6 : 1 })}
              >
                <T size={16} weight="600" color={K.bg}>Doubt {tgt.name} · {money(amtCents)}</T>
              </Pressable>
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
              <T size={13} muted>Doubters</T>
              <T size={44} weight="500" lh={1.15} style={{ letterSpacing: -1.6 }}>{money(pay.amountCents)}</T>
              <T muted numberOfLines={2} style={{ textAlign: "center" }}>{pay.label}</T>
            </View>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: K.line, backgroundColor: K.bg, paddingHorizontal: 16, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 }}>
                <T size={14} muted>{pay.kind === "stake" ? "Stake" : "Doubt"}</T>
                <T>{money(pay.amountCents)}</T>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderColor: K.line }}>
                <T size={14} muted>Total</T>
                <T weight="600">{money(pay.amountCents)}</T>
              </View>
            </View>
            {payState === "paid" ? (
              <View style={{ height: 56, borderRadius: 14, backgroundColor: K.blue, alignItems: "center", justifyContent: "center" }}>
                <T color={K.bg} weight="600" size={16}>✓  Paid</T>
              </View>
            ) : (
              <Pressable
                testID="pay-confirm"
                accessibilityLabel={`Pay ${money(pay.amountCents)}`}
                disabled={payState === "processing"}
                onPress={doPay}
                style={({ pressed }) => ({ height: 56, borderRadius: 14, backgroundColor: K.fg, alignItems: "center", justifyContent: "center", opacity: pressed || payState === "processing" ? 0.6 : 1 })}
              >
                <T size={16} weight="600" color={K.bg}>{payState === "processing" ? "Processing…" : `Pay ${money(pay.amountCents)}`}</T>
              </Pressable>
            )}
            <T size={12} muted style={{ textAlign: "center" }}>Paid with Whop · 5% fee on winnings only</T>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
