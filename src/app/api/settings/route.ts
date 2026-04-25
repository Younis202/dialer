import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const KEY = "voipms";

export async function GET() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  return NextResponse.json((row?.value as any) || {});
}

export async function POST(req: Request) {
  const body = await req.json();
  const existing = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (existing.length > 0) {
    await db.update(settings).set({ value: body }).where(eq(settings.key, KEY));
  } else {
    await db.insert(settings).values({ key: KEY, value: body });
  }
  return NextResponse.json({ ok: true });
}
