import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduledCalls } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(scheduledCalls).orderBy(asc(scheduledCalls.scheduledAt)).limit(200);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(scheduledCalls)
    .values({
      contactId: body.contactId || null,
      phone: body.phone,
      scheduledAt: body.scheduledAt,
      note: body.note || "",
      status: "pending",
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await db.delete(scheduledCalls).where(eq(scheduledCalls.id, id));
  return NextResponse.json({ ok: true });
}
