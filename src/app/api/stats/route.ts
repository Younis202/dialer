import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, contacts } from "@/lib/db/schema";
import { gte, sql } from "drizzle-orm";

export async function GET() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.getTime();

  const [todayAgg] = await db
    .select({
      n: sql<number>`count(*)::int`,
      mins: sql<number>`coalesce(sum(${calls.duration}),0)::int`,
      spend: sql<number>`coalesce(sum(${calls.cost}),0)::float`,
    })
    .from(calls)
    .where(gte(calls.startedAt, since));

  const [contactsAgg] = await db.select({ n: sql<number>`count(*)::int` }).from(contacts);

  return NextResponse.json({
    todayCalls: todayAgg?.n ?? 0,
    todayMinutes: Math.round((todayAgg?.mins ?? 0) / 60),
    todaySpend: todayAgg?.spend ?? 0,
    contacts: contactsAgg?.n ?? 0,
  });
}
