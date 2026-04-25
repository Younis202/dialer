import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lists, contactLists, contacts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = parseInt(id, 10);
  const [list] = await db.select().from(lists).where(eq(lists.id, listId));
  if (!list) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const members = await db
    .select({ contact: contacts })
    .from(contactLists)
    .innerJoin(contacts, eq(contactLists.contactId, contacts.id))
    .where(eq(contactLists.listId, listId));
  return NextResponse.json({ list, members: members.map((m) => m.contact) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = parseInt(id, 10);
  const body = await req.json();

  if (body.action === "add") {
    const ids: number[] = Array.isArray(body.contactIds)
      ? body.contactIds
      : body.contactId
        ? [body.contactId]
        : [];
    if (ids.length) {
      await db
        .insert(contactLists)
        .values(ids.map((cid) => ({ listId, contactId: cid })))
        .onConflictDoNothing();
    }
  } else if (body.action === "remove") {
    const ids: number[] = Array.isArray(body.contactIds)
      ? body.contactIds
      : body.contactId
        ? [body.contactId]
        : [];
    for (const cid of ids) {
      await db
        .delete(contactLists)
        .where(and(eq(contactLists.listId, listId), eq(contactLists.contactId, cid)));
    }
  } else {
    const patch: any = {};
    if (body.name) patch.name = body.name;
    if (body.color) patch.color = body.color;
    if (body.description !== undefined) patch.description = body.description;
    if (Object.keys(patch).length) {
      await db.update(lists).set(patch).where(eq(lists.id, listId));
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(lists).where(eq(lists.id, parseInt(id, 10)));
  return NextResponse.json({ ok: true });
}
