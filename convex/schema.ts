import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({ deviceId: v.string(), name: v.string(), whopUserId: v.optional(v.string()), sandbox: v.optional(v.boolean()) })
    .index("by_device", ["deviceId"]),
  challenges: defineTable({
    hostId: v.id("users"), goal: v.string(), targetSteps: v.number(),
    stakeCents: v.number(), bonusCents: v.number(), endsAt: v.number(),
    status: v.union(v.literal("open"), v.literal("settling"), v.literal("settled")),
    kind: v.optional(v.union(v.literal("steps"), v.literal("gym"), v.literal("run"), v.literal("custom"))),
    sandbox: v.optional(v.boolean()), // payments/payouts settle in-app instead of through Whop
    startedAt: v.optional(v.number()), // defaults to _creationTime
  }),
  participants: defineTable({
    challengeId: v.id("challenges"), userId: v.id("users"), progress: v.number(),
    paid: v.boolean(), purchaseUrl: v.optional(v.string()), paymentId: v.optional(v.string()),
    result: v.union(v.literal("pending"), v.literal("finished"), v.literal("quit")),
    verified: v.optional(v.boolean()), // approved photo/video proof counts as finished
  }).index("by_challenge", ["challengeId"]).index("by_user", ["userId"]),
  bets: defineTable({
    challengeId: v.id("challenges"), bettorId: v.id("users"), targetId: v.id("participants"),
    amountCents: v.number(), paid: v.boolean(), note: v.optional(v.string()), at: v.optional(v.number()),
    purchaseUrl: v.optional(v.string()), paymentId: v.optional(v.string()),
  }).index("by_target", ["targetId"]).index("by_challenge", ["challengeId"]),
  progressLogs: defineTable({
    participantId: v.id("participants"), steps: v.number(),
    source: v.union(v.literal("pedometer"), v.literal("manual")),
  }).index("by_participant", ["participantId"]),
  posts: defineTable({
    challengeId: v.id("challenges"), userId: v.id("users"), targetId: v.optional(v.id("participants")),
    type: v.union(v.literal("comment"), v.literal("doubt"), v.literal("believe"), v.literal("join"),
      v.literal("checkin"), v.literal("proof"), v.literal("finish")),
    text: v.optional(v.string()), amountCents: v.optional(v.number()),
    activity: v.optional(v.string()), proofKind: v.optional(v.union(v.literal("photo"), v.literal("video"))),
    status: v.optional(v.union(v.literal("review"), v.literal("approved"))),
    place: v.optional(v.string()), at: v.optional(v.number()), // at: display time (defaults to _creationTime)
  }).index("by_challenge", ["challengeId"]),
  beliefs: defineTable({ challengeId: v.id("challenges"), participantId: v.id("participants"), userId: v.id("users") })
    .index("by_participant", ["participantId"]),
  payouts: defineTable({
    challengeId: v.id("challenges"), userId: v.id("users"), amountCents: v.number(),
    reason: v.union(v.literal("refund"), v.literal("win"), v.literal("doubt_win")),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
    transferId: v.optional(v.string()),
  }).index("by_challenge", ["challengeId"]),
});
