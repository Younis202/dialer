import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, contacts } from "@/lib/db/schema";
import { gte, sql } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const [todayAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      seconds: sql<number>`coalesce(sum(${calls.duration}), 0)::int`,
      spend: sql<number>`coalesce(sum(${calls.cost}), 0)::float`,
    })
    .from(calls)
    .where(gte(calls.startedAt, startOfDay));

  const [contactAgg] = await db.select({ c: sql<number>`count(*)::int` }).from(contacts);

  return NextResponse.json({
    todayCalls: todayAgg?.count ?? 0,
    todayMinutes: Math.round((todayAgg?.seconds ?? 0) / 60),
    todaySpend: todayAgg?.spend ?? 0,
    contacts: contactAgg?.c ?? 0,
  });
}
