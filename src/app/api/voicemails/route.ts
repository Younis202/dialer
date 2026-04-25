import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voicemails } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(voicemails).orderBy(desc(voicemails.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(voicemails)
    .values({
      name: body.name,
      audioPath: body.audioPath || null,
      duration: body.duration || 0,
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await db.delete(voicemails).where(eq(voicemails.id, id));
  return NextResponse.json({ ok: true });
}
