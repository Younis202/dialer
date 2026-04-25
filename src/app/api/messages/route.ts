import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smsMessages } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(smsMessages).orderBy(desc(smsMessages.sentAt)).limit(200);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(smsMessages)
    .values({
      direction: "outbound",
      fromNumber: body.fromNumber || null,
      toNumber: body.toNumber,
      body: body.body,
      status: "queued",
      sentAt: Date.now(),
      contactId: body.contactId || null,
    })
    .returning();
  return NextResponse.json(row);
}
