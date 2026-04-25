"use client";
import { useState } from "react";
import useSWR from "swr";
import { Send, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { formatRelative } from "@/lib/utils";
import { parsePhone } from "@/lib/phone";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function MessagesPage() {
  const { data, mutate } = useSWR<any[]>("/api/messages", fetcher, { refreshInterval: 5000 });
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");

  async function send() {
    if (!to || !body) return toast.error("Number and message required");
    const parsed = parsePhone(to);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toNumber: parsed.e164 || to, body }),
    });
    toast.success("Message queued");
    setBody("");
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Messages" subtitle="SMS via Voip.ms (configure in Settings)" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="data-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">RECENT</span>
          </div>
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            {data?.map((m) => (
              <div key={m.id} className="p-4 hover:bg-accent/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm">{m.toNumber}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{m.status}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatRelative(m.sentAt)}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{m.body}</p>
              </div>
            ))}
            {data && data.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">No messages yet</div>
            )}
          </div>
        </div>

        <div className="data-card space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">COMPOSE</div>
          <div className="space-y-1.5"><Label>To</Label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+1 555 123 4567" /></div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={1600} placeholder="Hello from DIALR…" />
            <div className="text-[10px] font-mono text-muted-foreground text-right">{body.length}/1600</div>
          </div>
          <Button className="w-full" onClick={send}><Send className="h-3.5 w-3.5 mr-1.5" />Send</Button>
        </div>
      </div>
    </div>
  );
}
