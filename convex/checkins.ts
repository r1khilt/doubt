import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib";

const REVIEW_MS = 5000; // proof is auto-approved after review

export const submit = mutation({
  args: {
    deviceId: v.string(), participantId: v.id("participants"), text: v.optional(v.string()),
    activity: v.optional(v.string()), place: v.optional(v.string()), proofKind: v.optional(v.union(v.literal("photo"), v.literal("video"))),
  },
  handler: async (ctx, { deviceId, participantId, text, activity, place, proofKind }) => {
    const user = await requireUser(ctx, deviceId);
    const p = await ctx.db.get(participantId);
    if (!p || p.userId !== user._id) throw new ConvexError("Not your challenge");
    const c = (await ctx.db.get(p.challengeId))!;
    if (c.status !== "open" || Date.now() > c.endsAt) throw new ConvexError("Challenge has ended");
    const postId = await ctx.db.insert("posts", {
      challengeId: c._id, userId: user._id, targetId: participantId, type: proofKind ? "proof" : "checkin",
      text: text?.trim().slice(0, 280) || undefined, activity, place: place?.trim().slice(0, 80) || undefined, proofKind, status: proofKind ? "review" : undefined,
    });
    if (proofKind) await ctx.scheduler.runAfter(REVIEW_MS, internal.checkins.approve, { postId });
    return postId;
  },
});

export const approve = internalMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "review" || !post.targetId) return;
    await ctx.db.patch(postId, { status: "approved" });
    const p = await ctx.db.get(post.targetId);
    if (p && !p.verified) {
      await ctx.db.patch(p._id, { verified: true });
      await ctx.db.insert("posts", { challengeId: post.challengeId, userId: post.userId, targetId: p._id, type: "finish" });
    }
  },
});
