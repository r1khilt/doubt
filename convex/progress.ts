import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib";

export const log = mutation({
  args: { deviceId: v.string(), participantId: v.id("participants"), steps: v.number(), source: v.union(v.literal("pedometer"), v.literal("manual")) },
  handler: async (ctx, { deviceId, participantId, steps, source }) => {
    const user = await requireUser(ctx, deviceId);
    const p = await ctx.db.get(participantId);
    if (!p || p.userId !== user._id) throw new ConvexError("Not your progress");
    const c = (await ctx.db.get(p.challengeId))!;
    if (c.status !== "open" || Date.now() > c.endsAt) throw new ConvexError("Challenge has ended");
    if (steps <= p.progress) return null; // only accept counts that go up
    await ctx.db.patch(participantId, { progress: Math.floor(steps) });
    await ctx.db.insert("progressLogs", { participantId, steps: Math.floor(steps), source });
    if (c.targetSteps > 0 && p.progress < c.targetSteps && steps >= c.targetSteps) {
      await ctx.db.insert("posts", { challengeId: c._id, userId: user._id, targetId: participantId, type: "finish" });
    }
    return null;
  },
});
