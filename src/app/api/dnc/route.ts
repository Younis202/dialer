import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dnc } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(dnc).orderBy(desc(dnc.addedAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
  try {
    const [row] = await db
      .insert(dnc)
      .values({ phone: body.phone, reason: body.reason || "", addedAt: Date.now() })
      .onConflictDoNothing()
      .returning();
    return NextResponse.json(row || { ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
