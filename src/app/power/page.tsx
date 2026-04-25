"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Play, Pause, SkipForward, Phone, PhoneOff, ListOrdered, Tag, ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "@/components/ui/flag";
import { ActiveCall } from "@/components/dialer/active-call";
import { useSip } from "@/components/shell/sip-provider";
import { parsePhone } from "@/lib/phone";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Status = "idle" | "calling" | "live" | "wrap" | "paused";

export default function PowerDialerPage() {
  const sip = useSip();
  const { data: lists } = useSWR<any[]>("/api/lists", fetcher);
  const [listId, setListId] = useState<string>("");
  const { data: queue, mutate: refreshQueue } = useSWR<any[]>(
    listId ? `/api/lists/${listId}/contacts` : null,
    fetcher
  );
  const { data: dispositions } = useSWR<any[]>("/api/dispositions", fetcher);

  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [notes, setNotes] = useState("");
  const [disp, setDisp] = useState<string>("");
  const [contacted, setContacted] = useState(0);
  const [calls, setCalls] = useState(0);
  const startedAt = useRef(0);
  const sessionStart = useRef(0);
  const callIdRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  // Auto-tick for session duration
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // SIP state -> internal status
  useEffect(() => {
    if (status === "calling" && sip.state === "in_call") {
      setStatus("live");
      startedAt.current = Date.now();
    }
    if ((status === "live" || status === "calling") && (sip.state === "ended" || sip.state === "failed")) {
      setStatus("wrap");
    }
  }, [sip.state, status]);

  const current = queue?.[idx];
  const sessionDur = sessionStart.current ? Math.floor((Date.now() - sessionStart.current) / 1000) : 0;
  const callDur = startedAt.current && status === "live" ? Math.floor((Date.now() - startedAt.current) / 1000) : 0;
  void tick;

  async function callCurrent() {
    if (!current) return;
    if (!sip.registered) {
      toast.error("SIP not registered. Configure Voip.ms in Settings.");
      return;
    }
    setNotes(""); setDisp("");
    const parsed = parsePhone(current.phone);
    if (!sessionStart.current) sessionStart.current = Date.now();
    setStatus("calling");
    setCalls((n) => n + 1);

    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toNumber: parsed.e164 || current.phone,
        countryCode: parsed.country,
        countryName: parsed.countryName,
        provider: "voipms",
        contactId: current.id,
      }),
    });
    if (res.status === 403) {
      toast.error("DNC — skipping");
      setStatus("wrap");
      return;
    }
    const data = await res.json();
    callIdRef.current = data?.id ?? null;
    sip.client?.call(parsed.e164 || current.phone);
  }

  async function endCall() {
    sip.client?.hangup();
    setStatus("wrap");
  }

  async function next(saveDispositionFirst = true) {
    if (saveDispositionFirst && callIdRef.current) {
      await fetch(`/api/calls/${callIdRef.current}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          notes,
          dispositionId: disp ? parseInt(disp, 10) : null,
          duration: callDur,
          status: "ended",
          endedAt: Date.now(),
        }),
      });
      callIdRef.current = null;
      if (disp) setContacted((n) => n + 1);
    }
    setNotes(""); setDisp("");
    startedAt.current = 0;
    setStatus("idle");
    setIdx((i) => Math.min((queue?.length ?? 1) - 1, i + 1));
  }

  function pause() { setStatus("paused"); }

  const progress = queue?.length ? ((idx + (status === "wrap" ? 1 : 0)) / queue.length) * 100 : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Power Dialer" subtitle="Call through a list at speed. Tag, take notes, move on." />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        <div className="space-y-3">
          <div className="data-card space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              CHOOSE LIST
            </div>
            <Select value={listId} onValueChange={(v) => { setListId(v); setIdx(0); }}>
              <SelectTrigger><SelectValue placeholder="Pick a list…" /></SelectTrigger>
              <SelectContent>
                {(lists ?? []).map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name} ({l.contactCount ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {queue && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ListOrdered className="h-3.5 w-3.5" />
                {idx + 1} / {queue.length}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Calls" value={calls} />
            <Stat label="Contacted" value={contacted} />
            <Stat label="Session" value={formatDuration(sessionDur)} />
          </div>

          <div className="data-card !p-0 overflow-hidden max-h-[440px] flex flex-col">
            <div className="p-3 border-b border-border/40 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              UP NEXT
            </div>
            <div className="overflow-y-auto divide-y divide-border/20">
              {queue?.slice(idx, idx + 25).map((c, i) => {
                const p = parsePhone(c.phone);
                return (
                  <div
                    key={c.id}
                    className={`p-2.5 flex items-center gap-2 ${i === 0 ? "bg-primary/10" : ""}`}
                  >
                    <Flag country={p.country} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{c.name || c.phone}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{c.phone}</div>
                    </div>
                    {i === 0 && <Badge variant="default" className="text-[9px]">CURRENT</Badge>}
                  </div>
                );
              })}
              {(!queue || queue.length === 0) && (
                <div className="p-12 text-center text-xs text-muted-foreground">Choose a list to begin</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="surface p-4 flex items-center gap-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              PROGRESS
            </div>
            <div className="flex-1 h-1.5 bg-card rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-success"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums">{Math.round(progress)}%</span>
          </div>

          {current ? (
            <div className="data-card space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold">
                  {(current.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-2xl font-semibold truncate">
                    {current.name || "—"}
                  </div>
                  <div className="font-mono text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                    <Flag country={parsePhone(current.phone).country} size="sm" />
                    {current.phone}
                  </div>
                </div>
                {status === "live" && (
                  <Badge variant="default" className="font-mono">
                    LIVE · {formatDuration(callDur)}
                  </Badge>
                )}
                {status === "calling" && <Badge variant="outline">CALLING…</Badge>}
                {status === "wrap" && <Badge variant="outline">WRAP-UP</Badge>}
              </div>

              {(current.company || current.email) && (
                <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
                  {current.company && <div>Company: {current.company}</div>}
                  {current.email && <div>Email: {current.email}</div>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(dispositions ?? []).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDisp(String(d.id))}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      disp === String(d.id)
                        ? "border-transparent text-white"
                        : "border-border/60 hover:border-border bg-card/60"
                    }`}
                    style={disp === String(d.id) ? { background: d.color } : {}}
                  >
                    <Tag className="h-3 w-3 inline mr-1" />{d.name}
                  </button>
                ))}
              </div>

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (saved on next/end)…"
                rows={4}
              />

              <div className="flex gap-2">
                {status === "idle" && (
                  <Button className="flex-1" onClick={callCurrent}>
                    <Play className="h-4 w-4 mr-2" />Call
                  </Button>
                )}
                {(status === "calling" || status === "live") && (
                  <Button variant="destructive" className="flex-1" onClick={endCall}>
                    <PhoneOff className="h-4 w-4 mr-2" />End Call
                  </Button>
                )}
                {status === "wrap" && (
                  <Button className="flex-1" onClick={() => next(true)}>
                    <SkipForward className="h-4 w-4 mr-2" />Save & Next
                  </Button>
                )}
                {status === "idle" && (
                  <Button variant="outline" onClick={() => next(false)}>
                    <SkipForward className="h-4 w-4 mr-2" />Skip
                  </Button>
                )}
                <Button variant="outline" onClick={pause}>
                  <Pause className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="data-card py-20 text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
              <div className="text-sm text-muted-foreground">
                {listId ? "Queue complete" : "Choose a list to begin"}
              </div>
            </div>
          )}
        </div>
      </div>

      <ActiveCall
        open={status === "calling" || status === "live"}
        parsed={current ? parsePhone(current.phone) : null}
        peerLabel={current?.name}
        variant="telephony"
        state={sip.state}
        remoteStream={sip.remoteStream}
        onHangup={endCall}
        onMute={(m) => sip.client?.mute(m)}
        onHold={(h) => sip.client?.hold(h)}
        onDtmf={(d) => sip.client?.sendDTMF(d)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="data-card !p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-mono text-base mt-1 tabular-nums">{value}</div>
    </div>
  );
}
