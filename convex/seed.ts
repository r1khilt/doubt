import { internalMutation, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUser } from "./lib";

// Demo data that reproduces the "Doubters App Design" UI kit exactly. Seeded challenges settle in-app (sandbox).
// Settling after you reach 10,000 steps gives the design's results: +$23.75 won, $43.75 sent, Bianca gets $24.75.
const MIN = 60_000;
const HOUR = 60 * MIN;

export const demo = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    if (process.env.ALLOW_SEED !== "true") throw new ConvexError("Demo seeding is off (set ALLOW_SEED=true)");
    const me = await requireUser(ctx, deviceId);
    const now = Date.now();
    const run = now.toString(36);
    const users = new Map<string, Id<"users">>();
    const user = async (name: string) => {
      if (!users.has(name)) users.set(name, await ctx.db.insert("users", { deviceId: `seed-${name}-${run}`, name }));
      return users.get(name)!;
    };

    // "10k steps today": you vs Danny vs Bianca. 5h 12m left; pace 6,000 so you're "+240 ahead of pace".
    const endsAt = now + 5 * HOUR + 12 * MIN;
    const tenK = await ctx.db.insert("challenges", {
      hostId: me._id, goal: "10k steps today", kind: "steps", targetSteps: 10000, stakeCents: 2000, bonusCents: 0,
      endsAt, startedAt: endsAt - 13 * HOUR, status: "open", sandbox: true,
    });
    await ctx.scheduler.runAt(endsAt, internal.settle.run, { challengeId: tenK });
    const you = await ctx.db.insert("participants", { challengeId: tenK, userId: me._id, progress: 6240, paid: true, result: "pending" });
    const danny = await ctx.db.insert("participants", { challengeId: tenK, userId: await user("Danny"), progress: 2100, paid: true, result: "pending" });
    const bianca = await ctx.db.insert("participants", { challengeId: tenK, userId: await user("Bianca"), progress: 10000, paid: true, result: "pending" });

    const doubt = async (challengeId: Id<"challenges">, name: string, targetId: Id<"participants">, dollars: number, ago: number, note?: string) => {
      const bettorId = await user(name);
      await ctx.db.insert("bets", { challengeId, bettorId, targetId, amountCents: dollars * 100, paid: true, note, at: now - ago });
      await ctx.db.insert("posts", { challengeId, userId: bettorId, targetId, type: "doubt", amountCents: dollars * 100, text: note, at: now - ago });
    };
    const believe = async (challengeId: Id<"challenges">, name: string, participantId: Id<"participants">, ago: number) => {
      const userId = await user(name);
      await ctx.db.insert("beliefs", { challengeId, participantId, userId });
      await ctx.db.insert("posts", { challengeId, userId, targetId: participantId, type: "believe", at: now - ago });
    };
    const post = async (name: string, targetId: Id<"participants">, type: "comment" | "finish" | "checkin", ago: number, extra: { text?: string; place?: string; activity?: string } = {}) =>
      ctx.db.insert("posts", { challengeId: tenK, userId: await user(name), targetId, type, at: now - ago, ...extra });

    // On you: Rikhil and Kimmy put $20 on you quitting; 4 believe in you.
    await doubt(tenK, "Rikhil", you, 10, 40 * MIN);
    await doubt(tenK, "Kimmy", you, 10, 4 * MIN, "you are NOT making it past 8k. i've seen you on a sunday");
    for (const [name, ago] of [["Bianca", 7 * HOUR], ["Oskar", 6 * HOUR], ["Srinitha", 5 * HOUR], ["Gabe", 2 * HOUR]] as const) await believe(tenK, name, you, ago);

    // On Danny: 5 doubters ($10 of his $20 cap), 2 believers -> 71% doubt. 12 replies.
    await believe(tenK, "Srinitha", danny, 3 * HOUR);
    await doubt(tenK, "Kimmy", danny, 2, 6 * HOUR);
    await believe(tenK, "Bianca", danny, 5.5 * HOUR);
    await doubt(tenK, "Rikhil", danny, 2, 4.5 * HOUR);
    await doubt(tenK, "Maya", danny, 2, 2.5 * HOUR);
    await post("Danny", danny, "checkin", 2 * HOUR, { place: "Dolores Park", activity: "walk" });
    await doubt(tenK, "Leo", danny, 1, 90 * MIN);
    await post("Bianca", bianca, "finish", 1 * HOUR);
    await post("Rikhil", danny, "comment", 50 * MIN, { text: "2,100 by now is crazy work" });
    await post("Maya", danny, "comment", 30 * MIN, { text: "danny pls" });
    await doubt(tenK, "Oskar", danny, 3, 3 * MIN);
    await post("Oskar", danny, "comment", 2 * MIN, { text: "he's been on the couch since noon. easy money" });
    await post("Danny", danny, "comment", 1 * MIN, { text: "watch me. evening walk incoming" });

    // "No sugar for 7 days": Bianca on day 5. 2 doubters, 7 believers -> 22% doubt.
    const sugarStart = now - 4 * 24 * HOUR - 3 * HOUR;
    const sugar = await ctx.db.insert("challenges", {
      hostId: await user("Bianca"), goal: "No sugar for 7 days", kind: "custom", targetSteps: 0, stakeCents: 2000, bonusCents: 0,
      endsAt: sugarStart + 7 * 24 * HOUR, startedAt: sugarStart, status: "open", sandbox: true,
    });
    await ctx.scheduler.runAt(sugarStart + 7 * 24 * HOUR, internal.settle.run, { challengeId: sugar });
    const bSugar = await ctx.db.insert("participants", { challengeId: sugar, userId: await user("Bianca"), progress: 0, paid: true, result: "pending" });
    await doubt(sugar, "Danny", bSugar, 5, 3 * 24 * HOUR, "she has a whole drawer of sour patch kids");
    await doubt(sugar, "Kimmy", bSugar, 5, 2 * 24 * HOUR);
    for (const [i, name] of ["Srinitha", "Oskar", "Gabe", "Maya", "Leo", "Rikhil"].entries()) await believe(sugar, name, bSugar, (4 - i * 0.5) * 24 * HOUR);
    // You believe in Bianca ("You + 6 believe").
    await ctx.db.insert("beliefs", { challengeId: sugar, participantId: bSugar, userId: me._id });
    await ctx.db.insert("posts", { challengeId: sugar, userId: me._id, targetId: bSugar, type: "believe", at: now - 20 * HOUR });
    await ctx.db.insert("posts", { challengeId: sugar, userId: await user("Bianca"), targetId: bSugar, type: "checkin", text: "made it through a birthday party", at: now - 5 * HOUR });

    return tenK;
  },
});

// Reset between rehearsals: `npx convex run seed:wipe`. Internal only.
export const wipe = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.ALLOW_SEED !== "true") throw new Error("ALLOW_SEED is off");
    for (const t of ["payouts", "progressLogs", "posts", "beliefs", "bets", "participants", "challenges"] as const) {
      for (const r of await ctx.db.query(t).collect()) await ctx.db.delete(r._id);
    }
    for (const u of await ctx.db.query("users").collect()) if (u.deviceId.startsWith("seed-") || u.deviceId.startsWith("cli-")) await ctx.db.delete(u._id);
  },
});
