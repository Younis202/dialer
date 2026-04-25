"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Play, Pause, SkipForward, Phone, X } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function PowerPage() {
  const { data: lists } = useSWR<any[]>("/api/lists", fetcher);
  const { data: contacts } = useSWR<any[]>("/api/contacts", fetcher);
  const [selectedList, setSelectedList] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const [completed, setCompleted] = useState(0);

  function start() {
    const list = selectedList === "all" ? contacts : contacts?.filter(() => true) ?? [];
    if (!list?.length) return toast.error("No contacts to dial");
    setQueue(list); setIdx(0); setCompleted(0); setRunning(true); setPaused(false);
  }

  function next() {
    setCompleted((c) => c + 1);
    if (idx + 1 >= queue.length) { setRunning(false); toast.success("Campaign complete"); return; }
    setIdx((i) => i + 1);
  }

  function stop() { setRunning(false); setQueue([]); setIdx(0); setCompleted(0); }

  useEffect(() => {
    if (!running || paused) return;
    const t = setTimeout(() => next(), 8000);
    return () => clearTimeout(t);
  }, [idx, running, paused]); // eslint-disable-line

  const current = queue[idx];
  const pct = queue.length ? (completed / queue.length) * 100 : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Power Dialer" subtitle="Auto-dial through a list of contacts. Disposition each call. Save hours." />

      {!running ? (
        <div className="data-card max-w-xl">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">START CAMPAIGN</div>
          <div className="space-y-3">
            <Select value={selectedList} onValueChange={setSelectedList}>
              <SelectTrigger><SelectValue placeholder="Choose a list" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contacts ({contacts?.length ?? 0})</SelectItem>
                {lists?.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.count})</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="w-full" size="lg" onClick={start} disabled={!selectedList}>
              <Play className="h-4 w-4 mr-2" />Start Power Dialing
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="data-card text-center py-12">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">NOW DIALING</div>
            <div className="font-display text-4xl font-semibold tabular-nums">{current?.phone}</div>
            <div className="text-base text-muted-foreground mt-2">{current?.name || "—"} · {current?.company || ""}</div>
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl" onClick={() => setPaused((p) => !p)}>
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button size="icon" className="h-16 w-16 rounded-full"><Phone className="h-6 w-6" /></Button>
              <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl" onClick={next}><SkipForward className="h-5 w-5" /></Button>
              <Button size="icon" variant="destructive" className="h-14 w-14 rounded-2xl" onClick={stop}><X className="h-5 w-5" /></Button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="data-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">PROGRESS</span>
                <span className="font-mono text-sm">{completed}/{queue.length}</span>
              </div>
              <Progress value={pct} />
            </div>
            <div className="data-card">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">UP NEXT</div>
              <div className="space-y-2">
                {queue.slice(idx + 1, idx + 6).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono text-[10px]">{idx + i + 2}</Badge>
                    <span className="font-mono text-xs truncate">{c.phone}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
