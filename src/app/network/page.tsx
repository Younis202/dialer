"use client";
import { useEffect, useRef, useState } from "react";
import { Wifi, Phone, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { P2PClient } from "@/lib/p2p/peer";
import { toast } from "@/components/ui/sonner";
import { ActiveCall } from "@/components/dialer/active-call";

export default function NetworkPage() {
  const [myHandle, setMyHandle] = useState("");
  const [peers, setPeers] = useState<string[]>([]);
  const [callOpen, setCallOpen] = useState(false);
  const [state, setState] = useState("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const peerRef = useRef<P2PClient | null>(null);

  useEffect(() => {
    const p = new P2PClient({
      onMyHandle: setMyHandle,
      onPresence: setPeers,
      onState: (s) => { setState(s); if (s === "in_call") setCallOpen(true); if (s === "ended" || s === "failed") { setTimeout(() => setCallOpen(false), 800); } },
      onTrack: setRemoteStream,
      onIncoming: (from) => { toast(`Incoming P2P from ${from}`); setCallOpen(true); },
    });
    p.connect();
    peerRef.current = p;
    return () => p.destroy();
  }, []);

  function call(handle: string) {
    setCallOpen(true); setState("ringing_out");
    peerRef.current?.call(handle);
  }

  function copy() {
    navigator.clipboard.writeText(myHandle);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="DIALR Network"
        subtitle="Free, encrypted peer-to-peer calls between any two DIALR sessions on Earth"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        <div className="data-card text-center py-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">YOUR HANDLE</div>
          <div className="font-display text-3xl font-semibold tabular-nums tracking-tight mb-3">{myHandle || "..."}</div>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied" : "Copy Handle"}
          </Button>
          <p className="text-xs text-muted-foreground mt-6 max-w-xs mx-auto">
            Share this with anyone using DIALR — they can call you for free, anywhere, with HD audio.
          </p>
        </div>

        <div className="data-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-success" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">ONLINE NOW</span>
            <Badge variant="default" className="ml-auto font-mono">{peers.length}</Badge>
          </div>
          <div className="divide-y divide-border/30">
            {peers.filter((p) => p !== myHandle).map((p) => (
              <motion.button
                key={p}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => call(p)}
                className="w-full p-4 flex items-center gap-4 hover:bg-accent/30 text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono text-sm font-semibold">
                  {p.split("-")[1]?.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="font-mono">{p}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-success flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />ONLINE
                  </div>
                </div>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            ))}
            {peers.filter((p) => p !== myHandle).length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No other peers online. Open this page in another tab or share your handle.
              </div>
            )}
          </div>
        </div>
      </div>

      <ActiveCall
        open={callOpen}
        parsed={{ e164: "", country: "", countryName: "DIALR Network", national: "", international: "P2P Call", type: "p2p", isValid: true, flag: "" }}
        state={state}
        remoteStream={remoteStream}
        onHangup={() => { peerRef.current?.hangup(); setCallOpen(false); }}
        onMute={(m) => peerRef.current?.mute(m)}
      />
    </div>
  );
}
