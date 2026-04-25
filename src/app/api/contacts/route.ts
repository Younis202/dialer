import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { desc, ilike, or } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const rows = q
    ? await db
        .select()
        .from(contacts)
        .where(or(ilike(contacts.name, `%${q}%`), ilike(contacts.phone, `%${q}%`), ilike(contacts.company, `%${q}%`)))
        .orderBy(desc(contacts.lastCalledAt))
        .limit(500)
    : await db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(500);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
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
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}
