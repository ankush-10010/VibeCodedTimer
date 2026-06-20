import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncDailyTotal = mutation({
  args: { date: v.string(), totalMs: v.number(), laps: v.optional(v.array(v.number())) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called syncDailyTotal without authentication present");
    }
    
    // Check if entry exists for this user and date
    const existing = await ctx.db
      .query("stats")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", args.date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { 
        totalMs: args.totalMs,
        laps: args.laps || existing.laps || []
      });
    } else {
      await ctx.db.insert("stats", {
        userId: identity.subject,
        date: args.date,
        totalMs: args.totalMs,
        laps: args.laps || [],
      });
    }
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(90);
      
    return stats;
  },
});

export const getStreakStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(90);
      
    return stats;
  },
});
