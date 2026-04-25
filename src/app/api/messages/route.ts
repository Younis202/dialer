import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smsMessages, dnc, settings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

async function getSetting(key: string): Promise<any> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value;
}

export async function GET() {
  const rows = await db.select().from(smsMessages).orderBy(desc(smsMessages.sentAt)).limit(500);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const toNumber = body.toNumber as string;
  const text = (body.body as string)?.trim();
  if (!toNumber || !text) return NextResponse.json({ error: "toNumber and body required" }, { status: 400 });

  // DNC enforcement
  const blocked = await db.select().from(dnc).where(eq(dnc.phone, toNumber)).limit(1);
  if (blocked.length > 0) return NextResponse.json({ error: "DNC" }, { status: 403 });

  const cfg = await getSetting("voipms");
  const apiUser = cfg?.voipmsApiUser;
  const apiPass = cfg?.voipmsApiPass;
  const did = cfg?.voipmsDid;

  let status = "queued";
  let sid: string | null = null;
  let errorMsg: string | null = null;

  if (apiUser && apiPass && did) {
    // Strip + and non-digits for Voip.ms (E.164 without +)
    const dst = toNumber.replace(/\D/g, "");
    const didClean = did.replace(/\D/g, "");
    const url = new URL("https://voip.ms/api/v1/rest.php");
    url.searchParams.set("api_username", apiUser);
    url.searchParams.set("api_password", apiPass);
    url.searchParams.set("method", "sendSMS");
    url.searchParams.set("did", didClean);
    url.searchParams.set("dst", dst);
    url.searchParams.set("message", text.slice(0, 1600));
    try {
      const res = await fetch(url.toString(), { method: "GET" });
      const data = await res.json();
      if (data?.status === "success") {
        status = "sent";
        sid = data.sms ? String(data.sms) : null;
      } else {
        status = "failed";
        errorMsg = data?.status || "unknown";
      }
    } catch (e: any) {
      status = "failed";
      errorMsg = e?.message || "network error";
    }
  } else {
    status = "queued";
    errorMsg = "Voip.ms API not configured — message stored only";
  }

  const [row] = await db
    .insert(smsMessages)
    .values({
      direction: "outbound",
      fromNumber: did || null,
      toNumber,
      body: text,
      status,
      sentAt: Date.now(),
      sid,
    })
    .returning();

  if (status === "failed") {
    return NextResponse.json({ ...row, error: errorMsg }, { status: 502 });
  }
  return NextResponse.json(row);
}
