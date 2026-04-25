import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactLists, contacts } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = parseInt(id, 10);
  const rows = await db
    .select({ contact: contacts })
    .from(contactLists)
    .innerJoin(contacts, eq(contactLists.contactId, contacts.id))
    .where(eq(contactLists.listId, listId))
    .orderBy(asc(contacts.name));
  return NextResponse.json(rows.map((r) => r.contact));
}
