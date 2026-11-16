import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib";

export const add = mutation({
  args: { deviceId: v.string(), challengeId: v.id("challenges"), text: v.string(), targetId: v.optional(v.id("participants")) },
  handler: async (ctx, { deviceId, challengeId, text, targetId }) => {
    const user = await requireUser(ctx, deviceId);
    const t = text.trim().slice(0, 280);
    if (!t) throw new ConvexError("Say something");
    if (!(await ctx.db.get(challengeId))) throw new ConvexError("Challenge not found");
    return ctx.db.insert("posts", { challengeId, userId: user._id, targetId, type: "comment", text: t });
  },
});
