import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lists, contactLists } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      id: lists.id,
      name: lists.name,
      color: lists.color,
      description: lists.description,
      createdAt: lists.createdAt,
      contactCount: sql<number>`coalesce(count(${contactLists.contactId}), 0)::int`,
    })
    .from(lists)
    .leftJoin(contactLists, eq(contactLists.listId, lists.id))
    .groupBy(lists.id)
    .orderBy(desc(lists.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const [row] = await db
    .insert(lists)
    .values({
      name: body.name,
      description: body.description || "",
      color: body.color || "#10e6a5",
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}
