// Whop API v1 helpers. Plain fetch + Web Crypto only (runs in Convex's V8 runtime: no Node crypto, no Buffer).
// Env: WHOP_API_KEY, WHOP_COMPANY_ID (biz_...), WHOP_API_BASE (optional), WHOP_WEBHOOK_SECRET (ws_...).
// NOTE: Whop amounts are in major units (dollars, e.g. 1.5 = $1.50), not cents.

const DEFAULT_BASE = "https://sandbox-api.whop.com/api/v1";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function whopPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${process.env.WHOP_API_BASE || DEFAULT_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("WHOP_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Whop POST ${path} failed (${res.status}): ${text}`);
  return JSON.parse(text);
}

const toDollars = (cents: number) => Math.round(cents) / 100;

// One-time payment with an inline variant (Whop reuses a matching variant unless told otherwise).
export async function createCheckout(args: {
  amountCents: number;
  title: string;
  metadata: Record<string, string>;
  redirectUrl?: string;
}): Promise<{ id: string; purchaseUrl: string }> {
  const r = await whopPost("/checkout_configurations", {
    account_id: env("WHOP_COMPANY_ID"),
    mode: "payment",
    variant: {
      title: args.title,
      billing_type: "one_time",
      initial_price: toDollars(args.amountCents),
      currency: "usd",
    },
    metadata: args.metadata, // copied onto the resulting payment (payment.succeeded data.metadata)
    redirect_url: args.redirectUrl,
  });
  if (!r.purchase_url) throw new Error(`Whop checkout ${r.id} returned no purchase_url`);
  return { id: r.id, purchaseUrl: r.purchase_url };
}

// Balance transfer from our company balance to a Whop user (user_...).
export async function createTransfer(args: {
  amountCents: number;
  destinationUserId: string;
  idempotenceKey: string;
  metadata?: Record<string, string>;
  notes?: string;
}): Promise<{ id: string }> {
  const r = await whopPost("/transfers", {
    type: "balance",
    amount: toDollars(args.amountCents),
    currency: "usd",
    origin_id: env("WHOP_COMPANY_ID"),
    destination_id: args.destinationUserId,
    idempotence_key: args.idempotenceKey,
    metadata: args.metadata,
    notes: args.notes,
  });
  return { id: r.id };
}

// Standard Webhooks: HMAC-SHA256 over `${webhook-id}.${webhook-timestamp}.${rawBody}`,
// header `webhook-signature: v1,<base64> [v1,<base64> ...]`. Whop's HMAC key is the literal
// UTF-8 bytes of the whole "ws_..." secret (prefix included, NOT base64-decoded).
export async function verifyWebhook(rawBody: string, headers: Headers): Promise<any | null> {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return null;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return null;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env("WHOP_WEBHOOK_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signed = enc.encode(`${id}.${ts}.${rawBody}`);
  for (const part of sigHeader.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    try {
      const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
      // crypto.subtle.verify compares in constant time.
      if (await crypto.subtle.verify("HMAC", key, sigBytes, signed)) return JSON.parse(rawBody);
    } catch {
      // malformed base64 or unparseable body -> treat as invalid
    }
  }
  return null;
}

// v1 payload: { id, type, timestamp, data: { id: "pay_...", metadata, user: { id: "user_..." } } }
export function parsePaymentSucceeded(
  event: any,
): { kind?: string; rowId?: string; paymentId?: string; whopUserId?: string } | null {
  if (event?.type !== "payment.succeeded") return null;
  const d = event.data ?? {};
  return {
    kind: d.metadata?.kind,
    rowId: d.metadata?.rowId,
    paymentId: d.id,
    whopUserId: d.user?.id,
  };
}
