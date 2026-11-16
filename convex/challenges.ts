import { mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser, userByDevice } from "./lib";

const kind = v.union(v.literal("steps"), v.literal("gym"), v.literal("run"), v.literal("custom"));

const partsOf = (ctx: QueryCtx, challengeId: Id<"challenges">) =>
  ctx.db.query("participants").withIndex("by_challenge", (q) => q.eq("challengeId", challengeId)).collect();
const betsOf = (ctx: QueryCtx, challengeId: Id<"challenges">) =>
  ctx.db.query("bets").withIndex("by_challenge", (q) => q.eq("challengeId", challengeId)).collect();
const beliefsOn = (ctx: QueryCtx, participantId: Id<"participants">) =>
  ctx.db.query("beliefs").withIndex("by_participant", (q) => q.eq("participantId", participantId)).collect();
const nameOf = async (ctx: QueryCtx, id: Id<"users">) => (await ctx.db.get(id))?.name ?? "?";
const pct = (doubt: number, stake: number) => Math.round((100 * doubt) / Math.max(1, stake));
const sum = (xs: { amountCents: number }[]) => xs.reduce((s, b) => s + b.amountCents, 0);

function summary(c: Doc<"challenges">, parts: Doc<"participants">[], bets: Doc<"bets">[]) {
  const paid = parts.filter((p) => p.paid);
  return {
    _id: c._id, goal: c.goal, kind: c.kind ?? "steps", targetSteps: c.targetSteps, stakeCents: c.stakeCents,
    bonusCents: c.bonusCents, endsAt: c.endsAt, status: c.status, sandbox: !!c.sandbox,
    participantCount: paid.length,
    potCents: paid.length * c.stakeCents + sum(bets.filter((b) => b.paid)) + c.bonusCents,
  };
}

export const create = mutation({
  args: {
    deviceId: v.string(), goal: v.string(), kind: v.optional(kind), targetSteps: v.number(),
    stakeCents: v.number(), bonusCents: v.number(), endsAt: v.number(),
  },
  handler: async (ctx, { deviceId, kind = "steps", ...c }) => {
    const host = await requireUser(ctx, deviceId);
    if (!c.goal.trim()) throw new ConvexError("Add a goal");
    if (c.stakeCents < 100) throw new ConvexError("Stake must be at least $1");
    if (kind === "steps" && c.targetSteps <= 0) throw new ConvexError("Target must be above 0");
    if (c.endsAt <= Date.now()) throw new ConvexError("End time must be in the future");
    const id = await ctx.db.insert("challenges", {
      ...c, kind, goal: c.goal.trim(), targetSteps: kind === "steps" ? c.targetSteps : 0,
      hostId: host._id, status: "open", sandbox: !!host.sandbox,
    });
    await ctx.scheduler.runAt(c.endsAt, internal.settle.run, { challengeId: id });
    return id;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("challenges").order("desc").take(50);
    return Promise.all(all.map(async (c) => ({
      ...summary(c, await partsOf(ctx, c._id), await betsOf(ctx, c._id)),
      hostName: await nameOf(ctx, c.hostId),
    })));
  },
});

export const home = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const me = await userByDevice(ctx, deviceId);
    const now = Date.now();
    const mine = me ? await ctx.db.query("participants").withIndex("by_user", (q) => q.eq("userId", me._id)).order("desc").collect() : [];

    // My most recent open participation.
    let active = null;
    for (const p of mine) {
      const c = await ctx.db.get(p.challengeId);
      if (!c || c.status !== "open") continue;
      const on = (await ctx.db.query("bets").withIndex("by_target", (q) => q.eq("targetId", p._id)).collect()).filter((b) => b.paid);
      active = {
        challengeId: c._id, goal: c.goal, kind: c.kind ?? "steps", targetSteps: c.targetSteps, stakeCents: c.stakeCents,
        endsAt: c.endsAt, status: c.status, participantId: p._id, progress: p.progress, paid: p.paid, verified: !!p.verified,
        doubtCents: sum(on),
        doubters: await Promise.all(on.map(async (b) => ({ name: await nameOf(ctx, b.bettorId), amountCents: b.amountCents }))),
        believers: await Promise.all((await beliefsOn(ctx, p._id)).map(async (b) => ({ name: await nameOf(ctx, b.userId) }))),
      };
      break;
    }

    // Newest post by someone else on a challenge I'm in.
    let latestPost = null;
    for (const p of mine.slice(0, 5)) {
      const posts = await ctx.db.query("posts").withIndex("by_challenge", (q) => q.eq("challengeId", p.challengeId)).order("desc").take(10);
      const talk = posts.filter((x) => x.userId !== me!._id && (x.type === "comment" || x.type === "doubt") && x.text);
      const post = talk.find((x) => x.targetId === p._id) ?? talk[0];
      if (post && (!latestPost || post._creationTime > latestPost._creationTime)) {
        latestPost = {
          challengeId: post.challengeId, authorName: await nameOf(ctx, post.userId), text: post.text ?? "",
          type: post.type, _creationTime: post._creationTime,
          targetName: post.targetId ? await nameOf(ctx, (await ctx.db.get(post.targetId))!.userId) : undefined,
        };
      }
    }

    // Other paid challengers in open challenges, most doubted first.
    const open = (await ctx.db.query("challenges").order("desc").take(30)).filter((c) => c.status === "open" && c.endsAt > now);
    const friends = [];
    for (const c of open) {
      const parts = await partsOf(ctx, c._id);
      const bets = await betsOf(ctx, c._id);
      const posts = await ctx.db.query("posts").withIndex("by_challenge", (q) => q.eq("challengeId", c._id)).collect();
      const imIn = !!me && parts.some((p) => p.userId === me._id);
      for (const p of parts) {
        if (!p.paid || (me && p.userId === me._id)) continue;
        const on = bets.filter((b) => b.targetId === p._id);
        const paidOn = on.filter((b) => b.paid);
        const beliefs = await beliefsOn(ctx, p._id);
        const remainingCapCents = Math.max(0, c.stakeCents - sum(on));
        friends.push({
          participantId: p._id, challengeId: c._id, name: await nameOf(ctx, p.userId), goal: c.goal, kind: c.kind ?? "steps",
          progress: p.progress, targetSteps: c.targetSteps, stakeCents: c.stakeCents, endsAt: c.endsAt, verified: !!p.verified,
          doubtCents: sum(paidOn), doubtPct: pct(sum(paidOn), c.stakeCents),
          believerCount: beliefs.length,
          believerNames: await Promise.all(beliefs.slice(0, 4).map((b) => nameOf(ctx, b.userId))),
          doubterNames: await Promise.all(paidOn.slice(0, 4).map((b) => nameOf(ctx, b.bettorId))),
          remainingCapCents, iBelieve: !!me && beliefs.some((b) => b.userId === me._id),
          canDoubt: !imIn && remainingCapCents > 0,
          postCount: posts.filter((x) => x.targetId === p._id).length,
        });
      }
    }
    friends.sort((a, b) => b.doubtPct - a.doubtPct);
    return { active, latestPost, friends: friends.slice(0, 30) };
  },
});

export const get = query({
  args: { id: v.id("challenges"), deviceId: v.string() },
  handler: async (ctx, { id, deviceId }) => {
    const challenge = await ctx.db.get(id);
    if (!challenge) return null;
    const me = await userByDevice(ctx, deviceId);
    const parts = await partsOf(ctx, id);
    const bets = await betsOf(ctx, id);
    const payoutRows = await ctx.db.query("payouts").withIndex("by_challenge", (q) => q.eq("challengeId", id)).collect();
    const postRows = await ctx.db.query("posts").withIndex("by_challenge", (q) => q.eq("challengeId", id)).order("desc").take(50);
    const partName = new Map<string, string>();

    const participants = await Promise.all(parts.map(async (p) => {
      const on = bets.filter((b) => b.targetId === p._id);
      const paidDoubt = sum(on.filter((b) => b.paid));
      const beliefs = await beliefsOn(ctx, p._id);
      const name = await nameOf(ctx, p.userId);
      partName.set(p._id, name);
      return {
        _id: p._id, userId: p.userId, name, progress: p.progress, paid: p.paid, result: p.result,
        verified: !!p.verified, purchaseUrl: p.purchaseUrl, isMe: !!me && p.userId === me._id,
        doubtCents: paidDoubt, pendingDoubtCents: sum(on),
        remainingCapCents: Math.max(0, challenge.stakeCents - sum(on)),
        doubtPct: pct(paidDoubt, challenge.stakeCents),
        believerCount: beliefs.length, iBelieve: !!me && beliefs.some((b) => b.userId === me._id),
      };
    }));
    const mine = parts.find((p) => me && p.userId === me._id);
    const myBets = bets.filter((b) => me && b.bettorId === me._id)
      .map((b) => ({ _id: b._id, targetId: b.targetId, amountCents: b.amountCents, paid: b.paid, purchaseUrl: b.purchaseUrl }));
    const paidBets = await Promise.all(bets.filter((b) => b.paid).map(async (b) => ({
      _id: b._id, _creationTime: b._creationTime, targetId: b.targetId, bettorName: await nameOf(ctx, b.bettorId), amountCents: b.amountCents,
    })));
    const posts = await Promise.all(postRows.map(async (x) => ({
      _id: x._id, _creationTime: x._creationTime, type: x.type, authorName: await nameOf(ctx, x.userId), authorId: x.userId,
      targetId: x.targetId, targetName: x.targetId ? partName.get(x.targetId) : undefined,
      text: x.text, amountCents: x.amountCents, activity: x.activity, proofKind: x.proofKind, status: x.status,
    })));
    const payouts = await Promise.all(payoutRows.map(async (p) => ({
      _id: p._id, userId: p.userId, name: await nameOf(ctx, p.userId),
      amountCents: p.amountCents, reason: p.reason, status: p.status,
    })));
    const inCents = parts.filter((p) => p.paid).length * challenge.stakeCents + sum(bets.filter((b) => b.paid));
    return {
      challenge: { ...challenge, kind: challenge.kind ?? "steps", sandbox: !!challenge.sandbox },
      hostName: await nameOf(ctx, challenge.hostId), isHost: !!me && challenge.hostId === me._id,
      me: { userId: me?._id ?? null, participantId: mine?._id ?? null, hasBets: myBets.length > 0 },
      participants, myBets, bets: paidBets, posts, payouts,
      potCents: inCents + challenge.bonusCents,
      totals: { inCents, outCents: payoutRows.reduce((s, p) => s + p.amountCents, 0) },
    };
  },
});

export const join = mutation({
  args: { deviceId: v.string(), challengeId: v.id("challenges"), redirectUrl: v.optional(v.string()) },
  handler: async (ctx, { deviceId, challengeId, redirectUrl }) => {
    const user = await requireUser(ctx, deviceId);
    const c = await ctx.db.get(challengeId);
    if (!c || c.status !== "open" || c.endsAt <= Date.now()) throw new ConvexError("This challenge is closed");
    const existing = (await partsOf(ctx, challengeId)).find((p) => p.userId === user._id);
    if (existing) return existing._id;
    if ((await betsOf(ctx, challengeId)).some((b) => b.bettorId === user._id)) throw new ConvexError("You already doubted someone here — you can't also join");
    const id = await ctx.db.insert("participants", { challengeId, userId: user._id, progress: 0, paid: false, result: "pending" });
    if (!c.sandbox) {
      await ctx.scheduler.runAfter(0, internal.payments.createCheckout, {
        kind: "stake", rowId: id, amountCents: c.stakeCents, title: `Stake: ${c.goal}`, redirectUrl,
      });
    }
    return id;
  },
});
