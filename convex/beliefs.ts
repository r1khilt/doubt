import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib";

// Believing is free: it just shows support (and posts to the thread).
export const toggle = mutation({
  args: { deviceId: v.string(), participantId: v.id("participants") },
  handler: async (ctx, { deviceId, participantId }) => {
    const user = await requireUser(ctx, deviceId);
    const p = await ctx.db.get(participantId);
    if (!p) throw new ConvexError("Challenger not found");
    if (p.userId === user._id) throw new ConvexError("You can't believe in yourself");
    const existing = (await ctx.db.query("beliefs").withIndex("by_participant", (q) => q.eq("participantId", participantId)).collect())
      .find((b) => b.userId === user._id);
    if (existing) {
      await ctx.db.delete(existing._id);
      const post = (await ctx.db.query("posts").withIndex("by_challenge", (q) => q.eq("challengeId", p.challengeId)).collect())
        .find((x) => x.type === "believe" && x.userId === user._id && x.targetId === participantId);
      if (post) await ctx.db.delete(post._id);
      return false;
    }
    await ctx.db.insert("beliefs", { challengeId: p.challengeId, participantId, userId: user._id });
    await ctx.db.insert("posts", { challengeId: p.challengeId, userId: user._id, targetId: participantId, type: "believe" });
    return true;
  },
});
