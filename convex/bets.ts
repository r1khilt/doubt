import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { dollars, requireUser } from "./lib";

export const place = mutation({
  args: { deviceId: v.string(), targetId: v.id("participants"), amountCents: v.number(), note: v.optional(v.string()), redirectUrl: v.optional(v.string()) },
  handler: async (ctx, { deviceId, targetId, amountCents, note, redirectUrl }) => {
    const user = await requireUser(ctx, deviceId);
    const target = await ctx.db.get(targetId);
    if (!target) throw new ConvexError("That challenger is gone");
    const c = (await ctx.db.get(target.challengeId))!;
    if (c.status !== "open" || c.endsAt <= Date.now()) throw new ConvexError("Betting is closed");
    if (!Number.isInteger(amountCents) || amountCents < 100) throw new ConvexError("Minimum bet is $1");
    const parts = await ctx.db.query("participants").withIndex("by_challenge", (q) => q.eq("challengeId", c._id)).collect();
    if (parts.some((p) => p.userId === user._id)) throw new ConvexError("Challengers can't bet in their own challenge");
    const onTarget = await ctx.db.query("bets").withIndex("by_target", (q) => q.eq("targetId", targetId)).collect();
    const used = onTarget.reduce((s, b) => s + b.amountCents, 0);
    const cap = c.stakeCents - used;
    const name = (await ctx.db.get(target.userId))?.name ?? "them";
    if (amountCents > cap) throw new ConvexError(cap > 0 ? `Max bet on ${name} is ${dollars(cap)}` : `${name} is fully doubted`);
    const id = await ctx.db.insert("bets", {
      challengeId: c._id, bettorId: user._id, targetId, amountCents, paid: false, note: note?.trim().slice(0, 280) || undefined,
    });
    if (!c.sandbox) {
      await ctx.scheduler.runAfter(0, internal.payments.createCheckout, {
        kind: "bet", rowId: id, amountCents, title: `Doubt ${name}: ${c.goal}`, redirectUrl,
      });
    }
    return id;
  },
});
