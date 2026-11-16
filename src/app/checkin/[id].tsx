import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMe } from "@/me";
import { T } from "@/theme";
import { errText } from "@/ui";
import { Avatar, Btn, Card, Chip, Field, Label, Page, TopBar, Txt } from "@/kit-b";

type Activity = "walk" | "gym" | "run" | "other";
type Media = { kind: "photo" | "video"; uri: string; seconds?: number };
const ACTIVITIES: Activity[] = ["walk", "gym", "run", "other"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function CheckIn() {
  const { id, c } = useLocalSearchParams<{ id: string; c?: string }>();
  const participantId = id as Id<"participants">;
  const { deviceId } = useMe();
  const home = useQuery(api.challenges.home, { deviceId });
  const challengeId = (c as Id<"challenges"> | undefined) ?? (home?.active?.participantId === participantId ? home.active.challengeId : undefined);
  const data = useQuery(api.challenges.get, challengeId ? { id: challengeId, deviceId } : "skip");
  const submit = useMutation(api.checkins.submit);

  const [activity, setActivity] = useState<Activity>("walk");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const me = data?.participants.find((p) => p._id === participantId);
  const post = postId ? data?.posts.find((p) => p._id === postId) : undefined;
  const verified = !!postId && !!media && (post?.status === "approved" || !!me?.verified);

  // Close shortly after the proof is verified (or right after a plain check-in posts).
  useEffect(() => {
    if (!postId) return;
    if (!media || verified) {
      const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace("/")), media ? 1800 : 600);
      return () => clearTimeout(t);
    }
  }, [postId, verified, media]);

  const pick = async (camera: boolean) => {
    setErr("");
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setErr("Camera access is off. Upload from your library instead.");
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: camera ? ["videos"] : ["images", "videos"], quality: 0.6, videoMaxDuration: 60 };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setMedia({ kind: a.type === "video" ? "video" : "photo", uri: a.uri, seconds: a.duration ? Math.round(a.duration / 1000) : undefined });
    } catch (e) {
      setErr(camera ? "Couldn't open the camera. Upload from your library instead." : errText(e));
    }
  };

  const post_ = async () => {
    setErr("");
    setBusy(true);
    try {
      const pid = await submit({ deviceId, participantId, text: text.trim() || undefined, activity, proofKind: media?.kind });
      setPostId(pid);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const ch = data?.challenge;
  const isSteps = !ch || ch.kind === "steps" || !ch.kind;
  const progress = me?.progress ?? home?.active?.progress ?? 0;
  const target = ch?.targetSteps ?? home?.active?.targetSteps ?? 0;
  const frac = ch ? Math.min(1, Math.max(0, (Date.now() - ch._creationTime) / Math.max(1, ch.endsAt - ch._creationTime))) : 0;
  const ahead = progress >= target * frac;
  const bars = barsFor(progress);
  const best = bars.indexOf(Math.max(...bars.slice(0, -1)));
  const secs = media?.seconds ?? 0;

  return (
    <Page
      footer={
        <>
          {err ? <Txt size={13} style={{ color: T.red, textAlign: "center" }}>{err}</Txt> : null}
          {postId && media ? (
            <View style={{ height: 56, borderRadius: 14, borderWidth: 1, borderColor: verified ? T.blue : T.line, alignItems: "center", justifyContent: "center", backgroundColor: T.card }}>
              <Txt weight="600" style={{ color: verified ? T.blue : T.fg }} testID="proof-status">
                {verified ? "Verified ✓ — you're marked as finished" : "In review…"}
              </Txt>
            </View>
          ) : (
            <Btn title="Post check-in" onPress={post_} loading={busy} disabled={!!postId || !challengeId} testID="post-checkin" />
          )}
        </>
      }
    >
      <TopBar title="Check in" />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Txt size={32} weight="500" style={{ letterSpacing: -1.2 }}>{progress.toLocaleString()}</Txt>
            <Txt muted size={14}>steps</Txt>
          </View>
          <Txt muted size={12}>synced from iPhone · now</Txt>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 64 }}>
          {bars.map((h, i) => (
            <View key={i} style={{ flex: 1, height: h, borderRadius: 3, backgroundColor: i === bars.length - 1 ? T.fg : i === best ? T.blue : T.line }} />
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt muted size={11}>start</Txt>
          {isSteps && target ? <Txt muted size={11}>{Math.max(0, target - progress).toLocaleString()} to go</Txt> : null}
          <Txt muted size={11}>now</Txt>
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <Label>What are you doing?</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {ACTIVITIES.map((a) => <Chip key={a} label={cap(a)} active={activity === a} onPress={() => setActivity(a)} />)}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Label>Proof</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ProofButton title="Record video" sub="Show you did it" onPress={() => pick(true)} testID="record-video" />
          <ProofButton title="Upload" sub="Photo or video" onPress={() => pick(false)} testID="upload-proof" />
        </View>
        {media ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.card }}>
            {media.kind === "photo" ? (
              <Image source={{ uri: media.uri }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: T.line }} />
            ) : (
              <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: T.line, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 13, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: T.fg, marginLeft: 3 }} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Txt weight="500">{media.kind === "video" ? `Video attached${secs ? ` · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : ""}` : "Photo attached"}</Txt>
              <Txt muted size={12}>Attached as proof you finished</Txt>
            </View>
            {!postId ? (
              <Pressable onPress={() => setMedia(null)} accessibilityLabel="remove-proof"><Txt muted size={13}>Remove</Txt></Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <Field label="Say something" value={text} onChangeText={setText} placeholder={isSteps && target ? `${Math.max(0, target - progress).toLocaleString()} to go. Doubters, start saying sorry` : "Talk your talk"} testID="checkin-text" />

      <View style={{ gap: 8 }}>
        <Label>Friends will see</Label>
        <View style={{ borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: T.line, padding: 12, paddingHorizontal: 14, flexDirection: "row", gap: 10 }}>
          <Avatar name={me?.name ?? "You"} size={32} filled={T.blue} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 13, color: T.muted }}>
              <Text style={{ color: T.fg, fontWeight: "600" }}>You</Text> {media ? `posted ${media.kind} proof` : "checked in"} · {activity}
            </Text>
            <Txt>{text.trim() || "…"}</Txt>
            {isSteps && target ? (
              <Txt size={12} style={{ color: T.blue }}>{progress.toLocaleString()} / {target.toLocaleString()} · {ahead ? "ahead of pace" : "behind pace"}</Txt>
            ) : null}
          </View>
        </View>
      </View>
    </Page>
  );
}

function ProofButton({ title, sub, onPress, testID }: { title: string; sub: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityLabel={testID} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 56, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.card, paddingHorizontal: 14, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Txt size={15} weight="500">{title}</Txt>
      <Txt muted size={12}>{sub}</Txt>
    </Pressable>
  );
}

// Decorative hourly bars derived from the step count (last bar = "now").
function barsFor(steps: number) {
  const seed = [0.2, 0.6, 0.27, 0.8, 0.4, 1, 0.53, 0.37];
  const scale = Math.min(1, 0.25 + steps / 12000);
  return seed.map((v) => Math.max(6, Math.round(64 * v * scale)));
}
