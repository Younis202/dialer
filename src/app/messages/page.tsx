"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Send, MessageSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/ui/flag";
import { toast } from "@/components/ui/sonner";
import { formatRelative } from "@/lib/utils";
import { parsePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function MessagesPage() {
  const { data, mutate } = useSWR<any[]>("/api/messages", fetcher, { refreshInterval: 6000 });
  const [activeNumber, setActiveNumber] = useState<string>("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState("");
  const [composeTo, setComposeTo] = useState("");

  const conversations = useMemo(() => {
    const m = new Map<string, { number: string; lastAt: number; lastBody: string; count: number; lastDir: string }>();
    for (const msg of data ?? []) {
      const num = msg.toNumber || msg.fromNumber || "";
      if (!num) continue;
      const e = m.get(num) || { number: num, lastAt: 0, lastBody: "", count: 0, lastDir: "outbound" };
      e.count++;
      if (msg.sentAt > e.lastAt) {
        e.lastAt = msg.sentAt;
        e.lastBody = msg.body;
        e.lastDir = msg.direction;
      }
      m.set(num, e);
    }
    return [...m.values()]
      .filter((c) => !filter || c.number.includes(filter))
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [data, filter]);

  const thread = useMemo(() => {
    if (!activeNumber) return [];
    return (data ?? [])
      .filter((m) => m.toNumber === activeNumber || m.fromNumber === activeNumber)
      .sort((a, b) => a.sentAt - b.sentAt);
  }, [data, activeNumber]);

  async function send(toNumber: string, text: string) {
    const parsed = parsePhone(toNumber);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toNumber: parsed.e164 || toNumber, body: text }),
    });
    if (res.ok) {
      mutate();
      return true;
    }
    return false;
  }

  async function sendInThread() {
    if (!activeNumber || !body.trim()) return;
    const ok = await send(activeNumber, body);
    if (ok) {
      setBody("");
      toast.success("Sent");
    } else {
      toast.error("Failed. Configure Voip.ms API in Settings.");
    }
  }

  async function startCompose() {
    if (!composeTo.trim()) return;
    const parsed = parsePhone(composeTo);
    setActiveNumber(parsed.e164 || composeTo);
    setComposeTo("");
  }

  const activeParsed = activeNumber ? parsePhone(activeNumber) : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-4.5rem)]">
      <PageHeader title="Messages" subtitle="SMS via Voip.ms (configure in Settings)" />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100%-6rem)]">
        <div className="data-card !p-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/40 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="+1 555 …"
                className="h-9 font-mono text-xs"
                onKeyDown={(e) => e.key === "Enter" && startCompose()}
              />
              <Button size="sm" variant="outline" onClick={startCompose}>
                New
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {conversations.map((c) => {
              const p = parsePhone(c.number);
              return (
                <button
                  key={c.number}
                  onClick={() => setActiveNumber(c.number)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-accent/30 transition-colors flex gap-3 items-start",
                    activeNumber === c.number && "bg-accent/40"
                  )}
                >
                  <Flag country={p.country} size="md" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-xs truncate">{c.number}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(c.lastAt)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.lastDir === "inbound" ? "← " : "→ "}{c.lastBody}
                    </div>
                  </div>
                </button>
              );
            })}
            {conversations.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">No conversations</div>
            )}
          </div>
        </div>

        <div className="data-card !p-0 flex flex-col overflow-hidden">
          {activeNumber ? (
            <>
              <div className="p-4 border-b border-border/40 flex items-center gap-3">
                <Flag country={activeParsed?.country} size="md" />
                <div>
                  <div className="font-mono text-sm">{activeParsed?.international || activeNumber}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {activeParsed?.countryName}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {thread.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    No messages yet — send the first one below.
                  </div>
                )}
                {thread.map((m) => {
                  const out = m.direction !== "inbound";
                  return (
                    <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                      <div className="max-w-[70%] space-y-0.5">
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                            out
                              ? "bg-primary/15 text-foreground border border-primary/30 rounded-br-md"
                              : "bg-card border border-border rounded-bl-md"
                          )}
                        >
                          {m.body}
                        </div>
                        <div className={cn(
                          "text-[10px] font-mono text-muted-foreground flex items-center gap-2",
                          out ? "justify-end" : "justify-start"
                        )}>
                          <Badge variant="outline" className="text-[9px] py-0 h-4">{m.status}</Badge>
                          <span>{formatRelative(m.sentAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/40 p-3 flex gap-2 items-end">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message…"
                  rows={2}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendInThread();
                  }}
                />
                <Button onClick={sendInThread} disabled={!body.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
                Select a conversation or compose new
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
