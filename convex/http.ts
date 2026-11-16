import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parsePaymentSucceeded, verifyWebhook } from "./whopApi";

const whopWebhook = httpAction(async (ctx, req) => {
  const body = await req.text();
  const event = await verifyWebhook(body, req.headers);
  if (!event) return new Response("bad signature", { status: 401 });
  const p = parsePaymentSucceeded(event);
  if (p?.rowId && p.kind) {
    await ctx.runMutation(internal.payments.markPaid, { kind: p.kind, rowId: p.rowId, paymentId: p.paymentId, whopUserId: p.whopUserId });
  } else {
    console.log("ignored webhook", event?.type);
  }
  return new Response("ok", { status: 200 });
});

// Bounce from Whop's https redirect back into the app (only app schemes allowed, so no open redirect).
const paidRedirect = httpAction(async (_ctx, req) => {
  const to = new URL(req.url).searchParams.get("to") ?? "";
  if (/^(exps?|doubters):\/\//.test(to)) return new Response(null, { status: 302, headers: { Location: to } });
  return new Response("Payment received. You can return to Doubters.", { status: 200 });
});

const http = httpRouter();
http.route({ path: "/paid", method: "GET", handler: paidRedirect });
http.route({ path: "/whop", method: "POST", handler: whopWebhook });
http.route({ path: "/whop-webhook", method: "POST", handler: whopWebhook });
export default http;
