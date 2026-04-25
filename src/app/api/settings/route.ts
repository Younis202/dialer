import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(settings);
  const out: Record<string, any> = {};
  for (const r of rows) out[r.key] = r.value;
  return NextResponse.json(out);
}

export async function PUT(req: Request) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settings)
      .values({ key, value: value as any })
      .onConflictDoUpdate({ target: settings.key, set: { value: value as any } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
  await db.delete(settings).where(eq(settings.key, key));
  return NextResponse.json({ ok: true });
}
