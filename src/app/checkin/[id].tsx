import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, Text, TextInput, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T } from "@/theme";
import { errText } from "@/ui";
import { Avatar, Btn, IconChevron, IconPin, IconVideo, Label, Page, TopBar, Txt, s } from "@/kit-b";

type Activity = "walk" | "gym" | "run" | "other";
type Media = { kind: "photo" | "video"; uri: string; seconds?: number };
const ACTIVITIES: Activity[] = ["walk", "gym", "run", "other"];
const BARS = [12, 36, 16, 48, 24, 60, 32, 22]; // design's hourly bars at 6,240 steps
const hourOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric" });

export default function CheckIn() {
  const { id, c } = useLocalSearchParams<{ id: string; c?: string }>();
  const participantId = id as Id<"participants">;
  const { deviceId } = useMe();
  const home = useQuery(api.challenges.home, { deviceId });
  const challengeId = (c as Id<"challenges"> | undefined) ?? (home?.active?.participantId === participantId ? home.active.challengeId : undefined);
  const data = useQuery(api.challenges.get, challengeId ? { id: challengeId, deviceId } : "skip");
  const submit = useMutation(api.checkins.submit);

  const [activity, setActivity] = useState<Activity>("walk");
  const [place, setPlace] = useState("Golden Gate Park");
  const [text, setText] = useState<string | null>(null);
  const [media, setMedia] = useState<Media | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const ch = data?.challenge;
  const me = data?.participants.find((p) => p._id === participantId);
  const isSteps = !ch?.kind || ch.kind === "steps";
  const progress = me?.progress ?? home?.active?.progress ?? 0;
  const target = ch?.targetSteps ?? home?.active?.targetSteps ?? 0;
  const startedAt = ch?.startedAt ?? ch?._creationTime ?? home?.active?.startedAt ?? Date.now();
  const endsAt = ch?.endsAt ?? home?.active?.endsAt ?? Date.now();
  const pace = target * Math.min(1, Math.max(0, (Date.now() - startedAt) / Math.max(1, endsAt - startedAt)));
  const toGo = Math.max(0, target - progress);
  const myDoubters = (data?.bets ?? []).filter((b) => b.targetId === participantId).map((b) => b.bettorName);
  const rival = myDoubters[myDoubters.length - 1] ?? home?.active?.doubters?.slice(-1)[0]?.name ?? "Doubters";
  const defaultText = isSteps && target ? (toGo > 0 ? `${toGo.toLocaleString()} to go. ${rival}, start saying sorry` : `Done. ${rival}, pay up`) : `${rival}, start saying sorry`;
  const message = text ?? defaultText;

  const post = postId ? data?.posts.find((p) => p._id === postId) : undefined;
  const verified = !!postId && !!media && (post?.status === "approved" || !!me?.verified);

  useEffect(() => {
    if (!postId || (media && !verified)) return;
    const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace("/")), media ? 1800 : 500);
    return () => clearTimeout(t);
  }, [postId, verified, media]);

  const pick = async (camera: boolean) => {
    setErr("");
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return setErr("Camera access is off. Choose from your library instead.");
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: camera ? ["videos"] : ["images", "videos"], quality: 0.6, videoMaxDuration: 60 };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setMedia({ kind: a.type === "video" ? "video" : "photo", uri: a.uri, seconds: a.duration ? Math.round(a.duration / 1000) : undefined });
    } catch (e) {
      setErr(camera ? "Couldn't open the camera. Choose from your library instead." : errText(e));
    }
  };
  const addProof = () => {
    if (Platform.OS === "web") return pick(false);
    Alert.alert("Add proof", "Show you hit your goal.", [
      { text: "Record video", onPress: () => pick(true) },
      { text: "Choose from library", onPress: () => pick(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const send = async () => {
    setErr("");
    setBusy(true);
    try {
      setPostId(await submit({ deviceId, participantId, text: message.trim() || undefined, activity, place: place.trim() || undefined, proofKind: media?.kind }));
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const scale = Math.min(1.06, Math.max(0.2, progress / 6240));
  const bars = BARS.map((h) => Math.max(4, Math.round(h * scale)));
  const best = Math.round((progress * 1500) / 6240 / 10) * 10;
  const secs = media?.seconds ?? 0;

  return (
    <Page
      gap={18}
      footer={
        <>
          {err ? <Txt size={13} style={{ color: T.red, textAlign: "center" }}>{err}</Txt> : null}
          {postId && media ? (
            <View style={{ height: 56, borderRadius: 14, borderWidth: 1, borderColor: verified ? T.blue : T.line, backgroundColor: T.card, alignItems: "center", justifyContent: "center" }}>
              <Txt size={16} weight="600" style={{ color: verified ? T.blue : T.fg }} testID="proof-status">{verified ? "Verified ✓ — you're marked as finished" : "In review…"}</Txt>
            </View>
          ) : (
            <Btn title="Post check-in" onPress={send} loading={busy} disabled={!!postId || !challengeId} testID="post-checkin" />
          )}
        </>
      }
    >
      <TopBar title="Check in" />

      <View style={[s.card, { padding: 16, gap: 14 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Txt size={32} weight="500" ls={-0.04}>{progress.toLocaleString()}</Txt>
            <Txt muted size={14}>steps</Txt>
          </View>
          <Txt muted size={12}>synced from iPhone · 1m</Txt>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 64 }}
          accessibilityLabel={`Steps per hour; the biggest hour was ${hourOf(startedAt + 5 * 3_600_000)} with ${best.toLocaleString()} steps`}>
          {bars.map((h, i) => (
            <View key={i} style={{ flex: 1, height: h, borderRadius: 3, backgroundColor: i === 5 ? T.blue : i === 7 ? T.fg : T.line }} />
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt muted size={11}>{hourOf(startedAt)}</Txt>
          <Txt muted size={11}>best hour: {hourOf(startedAt + 5 * 3_600_000)} · {best.toLocaleString()}</Txt>
          <Txt muted size={11}>now</Txt>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Label>What are you doing?</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {ACTIVITIES.map((a) => {
            const on = a === activity;
            return (
              <Pressable key={a} accessibilityLabel={`activity-${a}`} accessibilityState={{ selected: on }} onPress={() => setActivity(a)}
                style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? T.fg : T.card, borderWidth: on ? 0 : 1, borderColor: T.line }}>
                <Text style={{ fontSize: 14, color: on ? T.bg : T.fg, fontWeight: on ? "600" : "400" }}>{a[0].toUpperCase() + a.slice(1)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ height: 56, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 }}>
        <IconPin size={20} color={T.blue} />
        <View style={{ flex: 1, gap: 2 }}>
          <TextInput value={place} onChangeText={setPlace} accessibilityLabel="checkin-place" placeholder="Add a place" placeholderTextColor={T.dim}
            style={{ color: T.fg, fontSize: 15, fontWeight: "500", padding: 0 }} />
          <Txt muted size={12}>Location attached as proof</Txt>
        </View>
        <IconChevron size={16} color={T.muted} />
      </View>

      <Pressable onPress={addProof} testID="add-proof" accessibilityLabel="add-proof" disabled={!!postId}
        style={({ pressed }) => ({ height: 56, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}>
        {media?.kind === "photo" ? (
          <Image source={{ uri: media.uri }} style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: T.line }} />
        ) : (
          <IconVideo size={20} color={T.blue} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} weight="500">
            {media ? (media.kind === "video" ? `Video attached${secs ? ` · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : ""}` : "Photo attached") : "Add photo or video"}
          </Txt>
          <Txt muted size={12}>{media ? "Proof you hit your goal · tap to change" : "Proof you hit your goal"}</Txt>
        </View>
        <IconChevron size={16} color={T.muted} />
      </Pressable>

      <View style={{ gap: 8 }}>
        <Label>Say something</Label>
        <TextInput value={message} onChangeText={setText} testID="checkin-text" accessibilityLabel="checkin-text" placeholderTextColor={T.dim}
          style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, color: T.fg, paddingHorizontal: 14, fontSize: 15 }} />
      </View>

      <View style={{ gap: 8 }}>
        <Label>Friends will see</Label>
        <View style={{ borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: T.line, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Avatar name={me?.name ?? "You"} size={32} bg={T.blue} color={T.bg} fontSize={12} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 13, color: T.muted }}>
              <Text style={{ color: T.fg, fontWeight: "600" }}>You</Text> checked in · {activity}{place.trim() ? ` · ${place.trim()}` : ""}
            </Text>
            <Txt size={15}>{message || " "}</Txt>
            {isSteps && target ? (
              <Txt size={12} style={{ color: T.blue }}>{progress.toLocaleString()} / {target.toLocaleString()} · {progress >= pace ? "ahead of pace" : "behind pace"}</Txt>
            ) : null}
          </View>
        </View>
      </View>
    </Page>
  );
}
