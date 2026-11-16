import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { createTransfer } from "./whopApi";

export const load = internalQuery({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const p = await ctx.db.get(payoutId);
    if (!p) return null;
    const user = await ctx.db.get(p.userId);
    const c = await ctx.db.get(p.challengeId);
    return { ...p, whopUserId: user?.whopUserId, goal: c?.goal ?? "", sandbox: !!c?.sandbox };
  },
});

export const mark = internalMutation({
  args: { payoutId: v.id("payouts"), status: v.union(v.literal("sent"), v.literal("failed")), transferId: v.optional(v.string()) },
  handler: async (ctx, { payoutId, status, transferId }) => {
    await ctx.db.patch(payoutId, { status, transferId });
  },
});

export const send = internalAction({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const p = await ctx.runQuery(internal.payouts.load, { payoutId });
    if (!p || p.status === "sent") return;
    if (p.sandbox) {
      await ctx.runMutation(internal.payouts.mark, { payoutId, status: "sent", transferId: `sbx_${payoutId}` });
      return;
    }
    if (!p.whopUserId) {
      console.error("payout", payoutId, "has no Whop user id");
      await ctx.runMutation(internal.payouts.mark, { payoutId, status: "failed" });
      return;
    }
    try {
      const t = await createTransfer({
        amountCents: p.amountCents, destinationUserId: p.whopUserId, idempotenceKey: payoutId,
        metadata: { payoutId }, notes: `Doubters ${p.reason}: ${p.goal}`.slice(0, 100),
      });
      await ctx.runMutation(internal.payouts.mark, { payoutId, status: "sent", transferId: t.id });
    } catch (e) {
      console.error("transfer failed", payoutId, e);
      await ctx.runMutation(internal.payouts.mark, { payoutId, status: "failed" });
    }
  },
});

export const retry = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const p = await ctx.db.get(payoutId);
    if (!p || p.status !== "failed") throw new ConvexError("Only failed payouts can be retried");
    await ctx.db.patch(payoutId, { status: "queued" });
    await ctx.scheduler.runAfter(0, internal.payouts.send, { payoutId });
    return null;
  },
});
