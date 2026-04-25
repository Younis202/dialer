import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispositions } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  let rows = await db.select().from(dispositions).orderBy(asc(dispositions.sortOrder));
  // Seed defaults if empty
  if (rows.length === 0) {
    await db
      .insert(dispositions)
      .values([
        { name: "Connected", color: "#10e6a5", isSuccess: true, sortOrder: 1 },
        { name: "Voicemail", color: "#7c8aff", isSuccess: false, sortOrder: 2 },
        { name: "No Answer", color: "#94a3b8", isSuccess: false, sortOrder: 3 },
        { name: "Busy", color: "#f59e0b", isSuccess: false, sortOrder: 4 },
        { name: "Wrong Number", color: "#ef4444", isSuccess: false, sortOrder: 5 },
        { name: "Callback", color: "#06b6d4", isSuccess: false, sortOrder: 6 },
        { name: "Not Interested", color: "#64748b", isSuccess: false, sortOrder: 7 },
        { name: "Closed Won", color: "#22c55e", isSuccess: true, sortOrder: 8 },
      ])
      .onConflictDoNothing();
    rows = await db.select().from(dispositions).orderBy(asc(dispositions.sortOrder));
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const [row] = await db
    .insert(dispositions)
    .values({
      name: body.name,
      color: body.color || "#64748b",
      isSuccess: body.isSuccess || false,
      sortOrder: body.sortOrder || 0,
    })
    .returning();
  return NextResponse.json(row);
}
