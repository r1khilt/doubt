import { internalAction, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib";
import * as whop from "./whopApi";

const kind = v.union(v.literal("stake"), v.literal("bet"));
const STALE_MS = 15 * 60 * 1000;

export const createCheckout = internalAction({
  args: { kind, rowId: v.string(), amountCents: v.number(), title: v.string(), redirectUrl: v.optional(v.string()) },
  handler: async (ctx, { kind, rowId, amountCents, title, redirectUrl }) => {
    // Whop only accepts https redirects, so app deep links (exp://, doubters://) bounce through our /paid route.
    const redirect = redirectUrl && !redirectUrl.startsWith("https://")
      ? `${process.env.CONVEX_SITE_URL}/paid?to=${encodeURIComponent(redirectUrl)}`
      : redirectUrl;
    const { purchaseUrl } = await whop.createCheckout({ amountCents, title, metadata: { kind, rowId }, redirectUrl: redirect });
    await ctx.runMutation(internal.payments.setPurchaseUrl, { kind, rowId, purchaseUrl });
  },
});

export const setPurchaseUrl = internalMutation({
  args: { kind, rowId: v.string(), purchaseUrl: v.string() },
  handler: async (ctx, { kind, rowId, purchaseUrl }) => {
    const id = ctx.db.normalizeId(kind === "stake" ? "participants" : "bets", rowId);
    if (id && (await ctx.db.get(id))) await ctx.db.patch(id, { purchaseUrl });
  },
});

// Called from the Whop webhook. Idempotent: a row that is already paid is left alone.
export const markPaid = internalMutation({
  args: { kind: v.string(), rowId: v.string(), paymentId: v.optional(v.string()), whopUserId: v.optional(v.string()) },
  handler: async (ctx, { kind, rowId, paymentId, whopUserId }) => {
    const id = ctx.db.normalizeId(kind === "stake" ? "participants" : "bets", rowId);
    const row = id && (await ctx.db.get(id));
    if (!id || !row) return console.warn("markPaid: unknown row", kind, rowId);
    if (row.paid) return;
    await ctx.db.patch(id, { paid: true, paymentId });
    const userId = "bettorId" in row ? row.bettorId : row.userId;
    if (whopUserId) await ctx.db.patch(userId, { whopUserId });
    if ("bettorId" in row) {
      await ctx.db.insert("posts", { challengeId: row.challengeId, userId, targetId: row.targetId, type: "doubt", amountCents: row.amountCents, text: row.note });
    } else {
      await ctx.db.insert("posts", { challengeId: row.challengeId, userId, targetId: row._id, type: "join" });
    }
  },
});

// Unpaid stakes and bets older than 15 minutes stop holding a spot / counting toward the cap.
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_MS;
    for (const t of ["participants", "bets"] as const) {
      const stale = await ctx.db.query(t).filter((q) => q.and(q.eq(q.field("paid"), false), q.lt(q.field("_creationTime"), cutoff))).take(200);
      for (const r of stale) await ctx.db.delete(r._id);
    }
  },
});

// In-app payment for sandbox challenges: same markPaid path as the Whop webhook, after a short processing delay.
export const confirm = mutation({
  args: { deviceId: v.string(), kind, rowId: v.string() },
  handler: async (ctx, { deviceId, kind, rowId }) => {
    const user = await requireUser(ctx, deviceId);
    const id = ctx.db.normalizeId(kind === "stake" ? "participants" : "bets", rowId);
    const row = id && (await ctx.db.get(id));
    if (!row) throw new ConvexError("Payment not found");
    const owner = "bettorId" in row ? row.bettorId : row.userId;
    if (owner !== user._id) throw new ConvexError("Not your payment");
    const c = await ctx.db.get(row.challengeId);
    if (!c?.sandbox) throw new ConvexError("Complete payment in checkout");
    if (row.paid) return null;
    await ctx.scheduler.runAfter(1500, internal.payments.markPaid, { kind, rowId, paymentId: `sbx_${rowId}` });
    return null;
  },
});
