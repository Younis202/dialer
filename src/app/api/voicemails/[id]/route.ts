import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voicemails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const update: any = {};
  for (const k of ["read", "transcript"]) {
    if (k in body) update[k] = body[k];
  }
  const [row] = await db.update(voicemails).set(update).where(eq(voicemails.id, parseInt(id, 10))).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(voicemails).where(eq(voicemails.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
