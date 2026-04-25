import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, dnc, contacts } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 1000);
  const contactId = searchParams.get("contactId");

  const rows = contactId
    ? await db.select().from(calls).where(eq(calls.contactId, parseInt(contactId, 10))).orderBy(desc(calls.startedAt)).limit(limit)
    : await db.select().from(calls).orderBy(desc(calls.startedAt)).limit(limit);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = Date.now();
  const toNumber = body.toNumber as string;

  // DNC enforcement
  if (toNumber) {
    const blocked = await db.select().from(dnc).where(eq(dnc.phone, toNumber)).limit(1);
    if (blocked.length > 0) {
      return NextResponse.json(
        { error: "Number is on the Do Not Call list", reason: blocked[0].reason },
        { status: 403 }
      );
    }
  }

  const [row] = await db
    .insert(calls)
    .values({
      direction: body.direction || "outbound",
      fromNumber: body.fromNumber || null,
      toNumber,
      contactId: body.contactId || null,
      status: body.status || "ringing",
      startedAt: now,
      provider: body.provider || "voipms",
      countryCode: body.countryCode || "",
      countryName: body.countryName || "",
      duration: 0,
      cost: 0,
    })
    .returning();

  // Update contact last-called timestamp
  if (body.contactId) {
    try {
      await db
        .update(contacts)
        .set({ lastCalledAt: now, callCount: sql`${contacts.callCount} + 1` })
        .where(eq(contacts.id, body.contactId));
    } catch {}
  }

  return NextResponse.json(row);
}
