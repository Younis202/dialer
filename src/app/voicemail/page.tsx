"use client";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Voicemail, Phone, Trash2, Play, Pause, Circle } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/ui/flag";
import { formatDuration, formatRelative } from "@/lib/utils";
import { parsePhone } from "@/lib/phone";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function VoicemailPage() {
  const router = useRouter();
  const { data, mutate } = useSWR<any[]>("/api/voicemails", fetcher, { refreshInterval: 15000 });
  const [playing, setPlaying] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle(v: any) {
    if (!v.audioUrl) {
      toast.error("No recording attached");
      return;
    }
    if (playing === v.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(v.audioUrl);
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play().catch(() => toast.error("Cannot play recording"));
    setPlaying(v.id);
    if (!v.read) markRead(v.id);
  }

  async function markRead(id: number) {
    await fetch(`/api/voicemails/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    mutate();
  }

  async function remove(id: number) {
    await fetch(`/api/voicemails/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Voicemail"
        subtitle={`${data?.filter((v) => !v.read).length ?? 0} new`}
      />

      <div className="data-card !p-0 overflow-hidden">
        <div className="divide-y divide-border/30">
          {data?.map((v) => {
            const p = parsePhone(v.fromNumber);
            return (
              <div key={v.id} className="p-4 flex items-center gap-4 hover:bg-accent/30">
                {!v.read && <Circle className="h-2 w-2 fill-info text-info shrink-0" />}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-10 w-10 shrink-0"
                  onClick={() => toggle(v)}
                >
                  {playing === v.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Flag country={p.country} size="md" />
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-sm truncate ${!v.read ? "font-semibold" : ""}`}>
                    {v.fromNumber}
                  </div>
                  {v.transcript && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 italic">
                      “{v.transcript}”
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {formatDuration(v.duration || 0)}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground w-20 text-right">
                  {formatRelative(v.receivedAt)}
                </span>
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/?dial=${encodeURIComponent(v.fromNumber)}`)}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {data && data.length === 0 && (
            <div className="p-16 text-center">
              <Voicemail className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
              <div className="text-sm text-muted-foreground">No voicemails</div>
              <div className="text-xs text-muted-foreground/70 mt-1">
                Voicemails arriving via your Voip.ms inbox will appear here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
