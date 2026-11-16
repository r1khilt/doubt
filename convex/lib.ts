import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export async function userByDevice(ctx: QueryCtx, deviceId: string) {
  return ctx.db.query("users").withIndex("by_device", (q) => q.eq("deviceId", deviceId)).unique();
}

export async function requireUser(ctx: QueryCtx, deviceId: string) {
  const user = await userByDevice(ctx, deviceId);
  if (!user) throw new ConvexError("Unknown device — restart the app");
  return user;
}

// Finished = approved proof, or (for step challenges) hitting the step target.
export const isFinished = (c: Doc<"challenges">, p: Doc<"participants">) =>
  !!p.verified || ((c.kind ?? "steps") === "steps" && c.targetSteps > 0 && p.progress >= c.targetSteps);
