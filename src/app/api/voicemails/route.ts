import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voicemails } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(voicemails).orderBy(desc(voicemails.receivedAt)).limit(200);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(voicemails)
    .values({
      fromNumber: body.fromNumber || "",
      audioUrl: body.audioUrl || null,
      duration: body.duration || 0,
      transcript: body.transcript || "",
      read: false,
      receivedAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}
