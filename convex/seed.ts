import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUser } from "./lib";

// Made-up people so the demo looks alive. Seeded challenges settle in-app (sandbox), rows are pre-paid.
const ME = "@me";
type Spec = {
  goal: string; targetSteps: number; stake: number; hours: number;
  people: [string, number][]; // [name, steps]  (ME = the device that loaded the demo)
  doubts: [string, string, number, string?][]; // [doubter, target, dollars, trash talk]
  believes?: [string, string][]; // [believer, target]
  talk?: [string, string, string?][]; // [author, text, target]
};

const MAIN: Spec = {
  goal: "10k steps today", targetSteps: 10000, stake: 20, hours: 1,
  people: [["Jake", 4200], ["Maya", 10400], ["Ali", 11800], ["Priya", 7900], ["Marcus", 2300], ["Sofia", 9100]],
  doubts: [
    ["Sam", "Jake", 10, "jake has never walked 10k in his life"], ["Omar", "Jake", 5, "easy money"],
    ["Leo", "Maya", 10, "she skipped leg day for a month"], ["Nina", "Marcus", 15, "marcus is on the couch rn i can see him"],
    ["Zoe", "Sofia", 8], ["Kai", "Priya", 12, "priya's whole personality is brunch"],
  ],
  believes: [["Ruby", "Jake"], ["Theo", "Marcus"], ["Iris", "Priya"], ["Owen", "Sofia"], ["Jade", "Sofia"]],
  talk: [["Jake", "watch me. evening walk incoming", "Jake"], ["Marcus", "2.3k is a warmup. relax", "Marcus"]],
};
const MINE: Spec = {
  goal: "12k steps today", targetSteps: 12000, stake: 20, hours: 6,
  people: [[ME, 8240], ["Danny", 6100], ["Bianca", 12000]],
  doubts: [
    ["Srinitha", "Danny", 15, "danny thinks the fridge counts as cardio"], ["Oskar", ME, 10, "been on the couch since noon. easy money"],
    ["Kimmy", ME, 10, "you are NOT making it past 8k. i've seen you on a sunday"],
  ],
  believes: [["Bea", ME], ["Gabe", ME], ["Sara", ME], ["Olu", ME], ["Kimmy", "Bianca"]],
  talk: [["Danny", "see you at 12k, buddy", "Danny"]],
};
const EXTRA: Spec[] = [
  { goal: "Weekend 25k steps", targetSteps: 25000, stake: 50, hours: 48,
    people: [["Ethan", 8200], ["Hana", 14100], ["Diego", 3100], ["Ava", 19800]],
    doubts: [["Ruby", "Diego", 40, "diego took an uber 2 blocks yesterday"], ["Theo", "Ethan", 25], ["Iris", "Hana", 20]],
    believes: [["Leo", "Diego"]] },
];

async function build(ctx: MutationCtx, me: Doc<"users">, s: Spec) {
  const challengeId = await ctx.db.insert("challenges", {
    hostId: me._id, goal: s.goal, kind: "steps", targetSteps: s.targetSteps, stakeCents: s.stake * 100, bonusCents: 0,
    endsAt: Date.now() + s.hours * 3600_000, status: "open", sandbox: true,
  });
  await ctx.scheduler.runAt(Date.now() + s.hours * 3600_000, internal.settle.run, { challengeId });
  const users = new Map<string, Id<"users">>([[ME, me._id]]);
  const user = async (name: string) => {
    if (!users.has(name)) users.set(name, await ctx.db.insert("users", { deviceId: `seed-${name}-${challengeId}`, name }));
    return users.get(name)!;
  };
  const pids = new Map<string, Id<"participants">>();
  for (const [name, progress] of s.people) {
    const userId = await user(name);
    const pid = await ctx.db.insert("participants", { challengeId, userId, progress, paid: true, result: "pending" });
    pids.set(name, pid);
    await ctx.db.insert("posts", { challengeId, userId, targetId: pid, type: "join" });
    if (progress >= s.targetSteps) await ctx.db.insert("posts", { challengeId, userId, targetId: pid, type: "finish" });
  }
  for (const [bettor, target, dollars, note] of s.doubts) {
    const bettorId = await user(bettor);
    const targetId = pids.get(target)!;
    await ctx.db.insert("bets", { challengeId, bettorId, targetId, amountCents: dollars * 100, paid: true, note });
    await ctx.db.insert("posts", { challengeId, userId: bettorId, targetId, type: "doubt", amountCents: dollars * 100, text: note });
  }
  for (const [believer, target] of s.believes ?? []) {
    const userId = await user(believer);
    const participantId = pids.get(target)!;
    await ctx.db.insert("beliefs", { challengeId, participantId, userId });
    await ctx.db.insert("posts", { challengeId, userId, targetId: participantId, type: "believe" });
  }
  for (const [author, text, target] of s.talk ?? []) {
    await ctx.db.insert("posts", { challengeId, userId: await user(author), targetId: target ? pids.get(target) : undefined, type: "comment", text });
  }
  return challengeId;
}

export const demo = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    if (process.env.ALLOW_SEED !== "true") throw new ConvexError("Demo seeding is off (set ALLOW_SEED=true)");
    const me = await requireUser(ctx, deviceId);
    for (const s of EXTRA) await build(ctx, me, s);
    await build(ctx, me, MINE); // you're a challenger here, so Home shows your card
    return build(ctx, me, MAIN); // you're NOT in this one, so you can doubt people (Revyl bet-cap test)
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
