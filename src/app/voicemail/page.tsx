"use client";
import { useRef, useState } from "react";
import useSWR from "swr";
import { Plus, Mic, Square, Play, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function VoicemailPage() {
  const { data, mutate } = useSWR<any[]>("/api/voicemails", fetcher);
  const [recording, setRecording] = useState(false);
  const [name, setName] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    recRef.current = rec;
    startTimeRef.current = Date.now();
    setRecording(true);
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function save() {
    if (!name || !audioUrl) return toast.error("Name and recording required");
    await fetch("/api/voicemails", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, audioPath: audioUrl, duration }),
    });
    toast.success("Voicemail saved");
    setName(""); setAudioUrl(null); setDuration(0);
    mutate();
  }

  async function remove(id: number) {
    await fetch(`/api/voicemails?id=${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Voicemail Drop" subtitle="Pre-record voicemails to drop instantly when you hit an answering machine" />

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        <div className="data-card space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">RECORD NEW</div>
          <div className="flex items-center justify-center py-8">
            {!recording ? (
              <Button size="icon" className="h-20 w-20 rounded-full" onClick={start}>
                <Mic className="h-8 w-8" />
              </Button>
            ) : (
              <Button size="icon" variant="destructive" className="h-20 w-20 rounded-full animate-pulse" onClick={stop}>
                <Square className="h-8 w-8" />
              </Button>
            )}
          </div>
          {audioUrl && (
            <div className="space-y-2">
              <audio src={audioUrl} controls className="w-full" />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Voicemail name" />
              <Button className="w-full" onClick={save}><Upload className="h-3.5 w-3.5 mr-1.5" />Save Voicemail</Button>
            </div>
          )}
        </div>

        <div className="data-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">SAVED ({data?.length ?? 0})</div>
          <div className="divide-y divide-border/30">
            {data?.map((v) => (
              <div key={v.id} className="p-4 flex items-center gap-3 hover:bg-accent/30">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Mic className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{v.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{v.duration}s</div>
                </div>
                {v.audioPath && <audio src={v.audioPath} controls className="h-8" />}
                <Button variant="ghost" size="icon" onClick={() => remove(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            {data && data.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm">No voicemails yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
