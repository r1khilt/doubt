/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as beliefs from "../beliefs.js";
import type * as bets from "../bets.js";
import type * as challenges from "../challenges.js";
import type * as checkins from "../checkins.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib from "../lib.js";
import type * as money from "../money.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as posts from "../posts.js";
import type * as progress from "../progress.js";
import type * as seed from "../seed.js";
import type * as settle from "../settle.js";
import type * as users from "../users.js";
import type * as whopApi from "../whopApi.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  beliefs: typeof beliefs;
  bets: typeof bets;
  challenges: typeof challenges;
  checkins: typeof checkins;
  crons: typeof crons;
  http: typeof http;
  lib: typeof lib;
  money: typeof money;
  payments: typeof payments;
  payouts: typeof payouts;
  posts: typeof posts;
  progress: typeof progress;
  seed: typeof seed;
  settle: typeof settle;
  users: typeof users;
  whopApi: typeof whopApi;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
