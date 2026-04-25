import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { desc, ilike, or, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (q) {
    const like = `%${q}%`;
    const rows = await db
      .select()
      .from(contacts)
      .where(or(ilike(contacts.name, like), ilike(contacts.phone, like), ilike(contacts.company, like), ilike(contacts.email, like)))
      .orderBy(desc(contacts.createdAt))
      .limit(500);
    return NextResponse.json(rows);
  }
  const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(500);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = Date.now();

  // Batch insert (CSV import)
  if (Array.isArray(body)) {
    const items = body
      .filter((b) => b && b.phone)
      .map((b) => ({
        name: b.name || "",
        phone: b.phone,
        email: b.email || "",
        company: b.company || "",
        country: b.country || "",
        tags: b.tags || "",
        notes: b.notes || "",
        favorite: !!b.favorite,
        createdAt: now,
      }));
    if (items.length === 0) return NextResponse.json({ inserted: 0 });
    // Skip duplicates by phone
    const existing = await db.select({ phone: contacts.phone }).from(contacts);
    const existingSet = new Set(existing.map((e) => e.phone));
    const fresh = items.filter((i) => !existingSet.has(i.phone));
    if (fresh.length > 0) {
      await db.insert(contacts).values(fresh);
    }
    return NextResponse.json({ inserted: fresh.length, skipped: items.length - fresh.length });
  }

  // Single insert
  if (!body.phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
  const [row] = await db
    .insert(contacts)
    .values({
      name: body.name || "",
      phone: body.phone,
      email: body.email || "",
      company: body.company || "",
      country: body.country || "",
      tags: body.tags || "",
      notes: body.notes || "",
      favorite: !!body.favorite,
      createdAt: now,
    })
    .returning();
  return NextResponse.json(row);
}
