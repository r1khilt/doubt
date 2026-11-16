// Pure payout math. All amounts in integer cents. See PRD "Money rules".
export const FEE_RATE = 0.05;
const net = (gross: number) => Math.floor(gross * (1 - FEE_RATE));

export type Reason = "refund" | "win" | "doubt_win";
export type PayoutLine = { userId: string; amountCents: number; reason: Reason };

export function computePayouts(input: {
  stakeCents: number;
  bonusCents: number;
  participants: { id: string; userId: string; finished: boolean }[]; // paid only
  bets: { bettorId: string; targetId: string; amountCents: number }[]; // paid only
}): PayoutLine[] {
  const { stakeCents, bonusCents, participants, bets } = input;
  const lines: PayoutLine[] = [];
  const add = (userId: string, amountCents: number, reason: Reason) => {
    if (amountCents > 0) lines.push({ userId, amountCents, reason });
  };
  const betsOn = (pid: string) => bets.filter((b) => b.targetId === pid);
  const finishers = participants.filter((p) => p.finished);
  const quitters = participants.filter((p) => !p.finished);

  // Quitters: each doubter gets their bet back + the same again (minus fee) from the stake.
  let pool = 0;
  for (const q of quitters) {
    let doubted = 0;
    for (const b of betsOn(q.id)) {
      doubted += b.amountCents;
      add(b.bettorId, b.amountCents, "refund");
      add(b.bettorId, net(b.amountCents), "doubt_win");
    }
    const leftover = stakeCents - doubted;
    if (finishers.length === 0) add(q.userId, leftover, "refund"); // rule 4
    else pool += leftover;
  }

  // Finishers: stake back + money bet against them + stake-weighted share of the pool + bonus share.
  const bonusShare = finishers.length ? Math.floor(bonusCents / finishers.length) : 0;
  for (const f of finishers) {
    add(f.userId, stakeCents, "refund");
    const doubtedAgainst = betsOn(f.id).reduce((s, b) => s + b.amountCents, 0);
    const poolShare = Math.floor(pool / finishers.length); // equal stakes ⇒ stake-weighted == equal
    add(f.userId, net(doubtedAgainst + poolShare + bonusShare), "win");
  }

  // Merge lines per (user, reason) so each person gets one transfer per reason.
  const merged = new Map<string, PayoutLine>();
  for (const l of lines) {
    const k = `${l.userId}|${l.reason}`;
    const m = merged.get(k);
    if (m) m.amountCents += l.amountCents;
    else merged.set(k, { ...l });
  }
  return [...merged.values()];
}
