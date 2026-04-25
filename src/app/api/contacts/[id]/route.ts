import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(contacts).where(eq(contacts.id, parseInt(id, 10)));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["name", "phone", "email", "company", "country", "tags", "notes", "favorite"];
  const patch: any = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  const [row] = await db.update(contacts).set(patch).where(eq(contacts.id, parseInt(id, 10))).returning();
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(contacts).where(eq(contacts.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
