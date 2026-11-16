import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("delete stale unpaid rows", { minutes: 5 }, internal.payments.cleanup, {});
export default crons;
