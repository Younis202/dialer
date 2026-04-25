import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scripts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(scripts).orderBy(desc(scripts.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title || !body.body) return NextResponse.json({ error: "title and body required" }, { status: 400 });
  const [row] = await db
    .insert(scripts)
    .values({
      title: body.title,
      body: body.body,
      category: body.category || "general",
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}
