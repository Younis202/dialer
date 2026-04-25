import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const patch: any = {};
  if (body.duration !== undefined) patch.duration = body.duration;
  if (body.cost !== undefined) patch.cost = body.cost;
  if (body.status !== undefined) patch.status = body.status;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.transcript !== undefined) patch.transcript = body.transcript;
  if (body.dispositionId !== undefined) patch.dispositionId = body.dispositionId;
  if (body.recordingUrl !== undefined) patch.recordingUrl = body.recordingUrl;
  if (body.endedAt !== undefined) patch.endedAt = body.endedAt;
  else patch.endedAt = Date.now();

  const [row] = await db.update(calls).set(patch).where(eq(calls.id, parseInt(id, 10))).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(calls).where(eq(calls.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
