import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, userByDevice } from "./lib";

export const ensure = mutation({
  args: { deviceId: v.string(), name: v.string() },
  handler: async (ctx, { deviceId, name }) => {
    const user = await userByDevice(ctx, deviceId);
    if (user) {
      if (user.name !== name) await ctx.db.patch(user._id, { name });
      return user._id;
    }
    return ctx.db.insert("users", { deviceId, name });
  },
});

export const me = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const u = await userByDevice(ctx, deviceId);
    return u ? { _id: u._id, name: u.name, sandbox: !!u.sandbox } : null;
  },
});

export const update = mutation({
  args: { deviceId: v.string(), name: v.optional(v.string()), sandbox: v.optional(v.boolean()) },
  handler: async (ctx, { deviceId, name, sandbox }) => {
    const u = await requireUser(ctx, deviceId);
    const patch: { name?: string; sandbox?: boolean } = {};
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (sandbox !== undefined) patch.sandbox = sandbox;
    await ctx.db.patch(u._id, patch);
    return null;
  },
});
