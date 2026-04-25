import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dispositions } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

const SEED = [
  { name: "Connected", color: "#10e6a5", isSuccess: true, sortOrder: 0 },
  { name: "Voicemail", color: "#3b82f6", isSuccess: false, sortOrder: 1 },
  { name: "No Answer", color: "#94a3b8", isSuccess: false, sortOrder: 2 },
  { name: "Busy", color: "#f59e0b", isSuccess: false, sortOrder: 3 },
  { name: "Wrong Number", color: "#ef4444", isSuccess: false, sortOrder: 4 },
  { name: "Not Interested", color: "#a855f7", isSuccess: false, sortOrder: 5 },
  { name: "Callback", color: "#06b6d4", isSuccess: false, sortOrder: 6 },
  { name: "Sale", color: "#10e6a5", isSuccess: true, sortOrder: 7 },
];

export async function GET() {
  let rows = await db.select().from(dispositions).orderBy(asc(dispositions.sortOrder));
  if (rows.length === 0) {
    await db.insert(dispositions).values(SEED).onConflictDoNothing();
    rows = await db.select().from(dispositions).orderBy(asc(dispositions.sortOrder));
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(dispositions)
    .values({
      name: body.name,
      color: body.color || "#64748b",
      isSuccess: !!body.isSuccess,
      sortOrder: body.sortOrder || 99,
    })
    .returning();
  return NextResponse.json(row);
}
