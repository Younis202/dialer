import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
  const contactId = searchParams.get("contactId");

  const q = db.select().from(calls).orderBy(desc(calls.startedAt)).limit(limit);
  const rows = contactId
    ? await db.select().from(calls).where(eq(calls.contactId, parseInt(contactId, 10))).orderBy(desc(calls.startedAt)).limit(limit)
    : await q;

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = Date.now();
  const [row] = await db
    .insert(calls)
    .values({
      direction: body.direction || "outbound",
      fromNumber: body.fromNumber || null,
      toNumber: body.toNumber,
      contactId: body.contactId || null,
      status: body.status || "ringing",
      startedAt: now,
      provider: body.provider || "demo",
      countryCode: body.countryCode || "",
      countryName: body.countryName || "",
      duration: 0,
      cost: 0,
    })
    .returning();
  return NextResponse.json(row);
}
