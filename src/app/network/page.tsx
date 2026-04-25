"use client";
import { useEffect, useRef, useState } from "react";
import { Wifi, Phone, Copy, Check, ShieldCheck, Globe2 } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useP2P } from "@/components/shell/p2p-provider";
import { ActiveCall } from "@/components/dialer/active-call";
import { toast } from "@/components/ui/sonner";

export default function NetworkPage() {
  const p2p = useP2P();
  const [copied, setCopied] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [activePeer, setActivePeer] = useState("");

  useEffect(() => {
    const s = p2p.state;
    if (s === "in_call" || s === "ringing_out" || s === "ringing_in") setCallOpen(true);
    if (s === "ended" || s === "failed") setTimeout(() => setCallOpen(false), 800);
  }, [p2p.state]);

  function call(handle: string) {
    if (!handle) return;
    if (handle === p2p.myHandle) return toast.error("That's your own handle");
    setActivePeer(handle);
    setCallOpen(true);
    p2p.client?.call(handle);
  }

  function copy() {
    if (!p2p.myHandle) return;
    navigator.clipboard.writeText(p2p.myHandle);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const others = p2p.peers.filter((x) => x !== p2p.myHandle);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="DIALR Network"
        subtitle="Free, encrypted peer-to-peer calls between any two DIALR sessions on Earth"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        <div className="space-y-4">
          <div className="data-card text-center py-8">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">
              YOUR HANDLE
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums tracking-tight mb-3">
              {p2p.myHandle || "··· ···"}
            </div>
            <Button variant="outline" size="sm" onClick={copy} disabled={!p2p.myHandle}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy Handle"}
            </Button>
            <p className="text-xs text-muted-foreground mt-6 max-w-xs mx-auto">
              Share this with anyone using DIALR — they can call you for free, anywhere, with HD audio.
            </p>
          </div>

          <div className="data-card space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              CALL BY HANDLE
            </div>
            <div className="flex gap-2">
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value.toUpperCase())}
                placeholder="DIALR-XXXXXX"
                className="font-mono"
              />
              <Button onClick={() => { call(target.trim()); setTarget(""); }} disabled={!target.trim()}>
                <Phone className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="data-card">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">All P2P calls are end-to-end encrypted via DTLS-SRTP</span>
            </div>
          </div>
        </div>

        <div className="data-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-success" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              ONLINE NOW
            </span>
            <Badge variant="default" className="ml-auto font-mono">{others.length}</Badge>
          </div>
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            {others.map((p) => (
              <motion.button
                key={p}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  FREE
                </div>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            ))}
            {others.length === 0 && (
              <div className="p-12 text-center">
                <Globe2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" strokeWidth={1.2} />
                <div className="text-sm text-muted-foreground">
                  No other peers online right now.
                </div>
                <div className="text-xs text-muted-foreground/70 mt-1">
                  Open this page in another tab or share your handle with a friend.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ActiveCall
        open={callOpen}
        parsed={null}
        peerLabel={activePeer || p2p.peers.find((x) => x !== p2p.myHandle) || "DIALR Network"}
        variant="p2p"
        state={p2p.state}
        remoteStream={p2p.remoteStream}
        onHangup={() => { p2p.client?.hangup(); setCallOpen(false); }}
        onMute={(m) => p2p.client?.mute(m)}
      />
    </div>
  );
}
