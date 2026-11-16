import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { computePayouts } from "./money";
import { isFinished, requireUser } from "./lib";

async function settle(ctx: MutationCtx, challengeId: Id<"challenges">) {
  const c = await ctx.db.get(challengeId);
  if (!c || c.status !== "open") return; // never runs twice
  await ctx.db.patch(challengeId, { status: "settling" });
  const parts = (await ctx.db.query("participants").withIndex("by_challenge", (q) => q.eq("challengeId", challengeId)).collect()).filter((p) => p.paid);
  const bets = (await ctx.db.query("bets").withIndex("by_challenge", (q) => q.eq("challengeId", challengeId)).collect()).filter((b) => b.paid);
  for (const p of parts) await ctx.db.patch(p._id, { result: isFinished(c, p) ? "finished" : "quit" });
  const lines = computePayouts({
    stakeCents: c.stakeCents, bonusCents: c.bonusCents,
    participants: parts.map((p) => ({ id: p._id, userId: p.userId, finished: isFinished(c, p) })),
    bets: bets.map((b) => ({ bettorId: b.bettorId, targetId: b.targetId, amountCents: b.amountCents })),
  });
  for (const l of lines) {
    const payoutId = await ctx.db.insert("payouts", {
      challengeId, userId: l.userId as Id<"users">, amountCents: l.amountCents, reason: l.reason, status: "queued",
    });
    await ctx.scheduler.runAfter(0, internal.payouts.send, { payoutId });
  }
  await ctx.db.patch(challengeId, { status: "settled" });
}

export const run = internalMutation({
  args: { challengeId: v.id("challenges") },
  handler: (ctx, { challengeId }) => settle(ctx, challengeId),
});

export const now = mutation({
  args: { deviceId: v.string(), challengeId: v.id("challenges") },
  handler: async (ctx, { deviceId, challengeId }) => {
    await requireUser(ctx, deviceId);
    await settle(ctx, challengeId);
    return null;
  },
});
