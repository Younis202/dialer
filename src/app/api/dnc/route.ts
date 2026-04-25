import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dnc } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(dnc).orderBy(desc(dnc.addedAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(dnc)
    .values({
      phone: body.phone,
      reason: body.reason || "",
      addedAt: Date.now(),
    })
    .onConflictDoNothing()
    .returning();
  return NextResponse.json(row || { ok: true, duplicate: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await db.delete(dnc).where(eq(dnc.id, id));
  return NextResponse.json({ ok: true });
}
