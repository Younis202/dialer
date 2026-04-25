import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dnc } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(dnc).where(eq(dnc.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
