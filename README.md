# Doubters

**Prove them wrong. Get paid.**

## Overview

Doubters lets a group put money on a shared challenge, each person tracked on their own, while friends bet on who quits.

- **Problem:** People pay for fitness and coaching programs, quit, then ask for refunds. Creators lose revenue, members lose motivation.
- **Solution:** Every member stakes money on the same goal (for example 30 days of gym). Data checks progress. Quitters' stakes go to finishers. Friends can bet against one specific person, which turns accountability into a game.
- **Why Whop:** Payments take the stakes, payouts send the winnings, and the app installs inside a creator's Whop community. A creator can run a paid challenge in minutes and add a bonus pot.

## Platform

An iOS app built with Expo and run in Expo Go (or a development build), a Convex backend for live data, webhooks and scheduled settlement, Whop for money in and out, and Revyl for AI end-to-end tests on a cloud iPhone simulator.

## Users and flows

| User | Wants | Does |
| --- | --- | --- |
| Host (creator or friend) | Engaged members, revenue | Creates a challenge: goal, stake amount, dates, optional bonus pot |
| Challenger | Motivation, winnings | Joins, pays the stake, checks in daily |
| Doubter | Fun, winnings | Bets against one named challenger |

### Core flow

1. Host creates the challenge, for example "10k steps today, $20 stake."
2. Host shares the link with friends or the community.
3. Challengers join and pay the stake through Whop checkout.
4. Doubters pick a challenger and bet against them, up to that person's stake.
5. Challengers check in. The live board shows who is still in, plus a Doubt Meter per person.
6. At the deadline the app settles: payouts go out through Whop and everyone sees the results screen.

## MVP scope (1-hour build)

Build only what the demo shows. It's an iOS app in Expo Go on real iPhones, with a Convex backend and all money in Whop's sandbox. Use only packages that already ship in Expo Go, so nobody needs Xcode for the demo.

### Must have

- [ ] Create-challenge screen: goal text, target steps, stake amount, end time
- [ ] Join and pay the stake: opens Whop hosted checkout in an in-app browser (expo-web-browser)
- [ ] Bet against a named challenger, capped at that person's stake (enforced in a Convex mutation)
- [ ] Live board: progress, status (in or out) and Doubt Meter, updated live through Convex useQuery
- [ ] Real step count from the iPhone's motion sensor (expo-sensors Pedometer, works in Expo Go on iOS)

## Rules enforced in Convex mutations

- `placeBet` rejects the bet if the bettor is a participant, or if the sum of bets on the target (paid and unpaid) plus this bet is more than the target's stake. Convex mutations are transactional, so two bets placed at once can't both slip past the cap.
- Unpaid bets and stakes older than 15 minutes are deleted by a scheduled cleanup, so they stop counting toward the cap.
- Only paid participants and paid bets count in `computePayouts()`.
- `logProgress` only accepts step counts that go up, and nothing after `endsAt`.

## Success metrics (after launch)

| Metric | Why it matters |
| --- | --- |
| Challenges created per host | Creators find it worth running |
| Share of challengers who finish | The app is actually motivating |
| Doubters per challenger | Shows how far it spreads |
| Fee revenue per challenge | The business works |

## Build and run

Built with Expo (SDK 58, expo-router) and Convex, with payments and payouts through Whop.

Live web app: https://doubters.expo.app

### Run

```bash
npm install
npm start          # scan the QR code with Expo Go (same Wi-Fi)
npm run tunnel     # same, but works across networks (ngrok, no Expo login)
```

The app reads `EXPO_PUBLIC_CONVEX_URL` from `.env.local` (written by `npx convex dev`) and falls back to the deployed URL.

Deploy the web app: `npx expo export --platform web && npx eas-cli deploy --prod`.

### How money moves

- **Real challenges**: stakes and doubts go through Whop hosted checkout; the `payment.succeeded` webhook (`/whop` on the Convex site URL) marks them paid; settlement sends winnings with Whop transfers. To go live, point `WHOP_API_BASE` at `https://api.whop.com/api/v1` and use a production API key.
- **Sandbox mode** (Settings toggle, per user): challenges you create while it's on take payments in-app and settle payouts instantly, with no Whop calls. Seeded demo challenges are always in sandbox mode.
- **Proof**: challengers post a photo or video check-in; it's approved after review (auto-approved after 5 seconds for now) and counts as finishing the challenge. Media isn't uploaded or stored.

### Convex environment variables

Set these on the Convex deployment (`npx convex env set NAME value`). Never commit real values.

| Variable | Purpose |
| --- | --- |
| `WHOP_API_KEY` | Whop API key |
| `WHOP_WEBHOOK_SECRET` | Verifies Whop webhook signatures |
| `WHOP_COMPANY_ID` | Whop company ID (`biz_...`) |
| `WHOP_API_BASE` | Optional Whop API base URL override |
| `ALLOW_SEED` | `true` enables "Load demo" and `seed:wipe` |

Reset demo data:

```bash
npx convex run seed:wipe
```

### Revyl tests

AI-driven end-to-end tests run on Revyl cloud iOS simulators. Test files live in `.revyl/tests/`:

- `create-challenge.yaml`: enter a name, create a "10k steps today" challenge, land on its board.
- `bet-cap.yaml`: load the demo, try to doubt Maya for $15, see "Max bet on Maya is $10".
- `settle-results.yaml`: load the demo, settle it, open Results.

```bash
brew install RevylAI/tap/revyl      # or: curl -fsSL https://revyl.com/install.sh | sh
revyl auth login
revyl init                          # writes .revyl/config.yaml
revyl build --profile preview --platform ios

revyl test create create-challenge --from-file .revyl/tests/create-challenge.yaml
revyl test create bet-cap --from-file .revyl/tests/bet-cap.yaml
revyl test create settle-results --from-file .revyl/tests/settle-results.yaml

revyl test run create-challenge
revyl test run bet-cap
revyl test run settle-results
```

`build.name` in each test must match the Revyl app name (`revyl app list`); they target `doubt-ios-preview` (Release build, JS bundled, no dev server needed).
