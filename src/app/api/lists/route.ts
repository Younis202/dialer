import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lists, contactLists } from "@/lib/db/schema";
import { desc, sql, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      color: lists.color,
      description: lists.description,
      createdAt: lists.createdAt,
      count: sql<number>`(select count(*)::int from ${contactLists} where ${contactLists.listId} = ${lists.id})`,
    })
    .from(lists)
    .orderBy(desc(lists.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(lists)
    .values({
      name: body.name,
      color: body.color || "#10e6a5",
      description: body.description || "",
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0", 10);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await db.delete(lists).where(eq(lists.id, id));
  return NextResponse.json({ ok: true });
}
