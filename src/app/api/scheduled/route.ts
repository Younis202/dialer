import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduledCalls } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(scheduledCalls)
    .where(eq(scheduledCalls.status, "pending"))
    .orderBy(asc(scheduledCalls.scheduledFor));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.phone || !body.scheduledFor) {
    return NextResponse.json({ error: "phone and scheduledFor required" }, { status: 400 });
  }
  const [row] = await db
    .insert(scheduledCalls)
    .values({
      phone: body.phone,
      name: body.name || "",
      contactId: body.contactId || null,
      scheduledFor: body.scheduledFor,
      notes: body.notes || "",
      status: "pending",
      createdAt: Date.now(),
    })
    .returning();
  return NextResponse.json(row);
}
