"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Mic, MicOff, Pause, Play, Hash, Volume2, Network as NetworkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { formatDuration } from "@/lib/utils";
import type { ParsedPhone } from "@/lib/phone";

interface Props {
  open: boolean;
  parsed: ParsedPhone | null;
  state: string;
  onHangup: () => void;
  onMute: (m: boolean) => void;
  onHold?: (h: boolean) => void;
  onDtmf?: (d: string) => void;
  remoteStream?: MediaStream | null;
  variant?: "telephony" | "p2p";
  peerLabel?: string;
}

export function ActiveCall({
  open, parsed, state, onHangup, onMute, onHold, onDtmf, remoteStream,
  variant = "telephony", peerLabel,
}: Props) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSeconds(0);
      setMuted(false);
      setHeld(false);
      return;
    }
    if (state !== "in_call") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [open, state]);

  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Visualize the *remote* stream when present (no extra getUserMedia)
  useEffect(() => {
    if (!open || state !== "in_call" || !remoteStream) return;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let mounted = true;

    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(remoteStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        if (!mounted || !canvasRef.current || !analyser) return;
        const c = canvasRef.current;
        const cx = c.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== c.clientWidth * dpr) {
          c.width = c.clientWidth * dpr;
          c.height = c.clientHeight * dpr;
        }
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        analyser.getByteFrequencyData(data);
        cx.clearRect(0, 0, c.clientWidth, c.clientHeight);
        const bars = 40;
        const step = Math.floor(data.length / bars);
        const w = c.clientWidth / bars;
        for (let i = 0; i < bars; i++) {
          const v = data[i * step] / 255;
          const h = Math.max(2, v * c.clientHeight * 0.85);
          const grad = cx.createLinearGradient(0, c.clientHeight, 0, c.clientHeight - h);
          grad.addColorStop(0, "hsla(158, 95%, 48%, 0.15)");
          grad.addColorStop(1, "hsla(158, 95%, 48%, 0.95)");
          cx.fillStyle = grad;
          cx.fillRect(i * w + 1, c.clientHeight - h, w - 2, h);
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {}

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx?.close().catch(() => {});
    };
  }, [open, state, remoteStream]);

  const STATUS_LABEL: Record<string, string> = {
    connecting: "CONNECTING",
    registering: "CONNECTING",
    ringing: "RINGING",
    ringing_out: "RINGING",
    ringing_in: "INCOMING",
    in_call: "IN CALL",
    ended: "ENDED",
    failed: "FAILED",
  };

  const isP2P = variant === "p2p";
  const title = isP2P ? (peerLabel || "DIALR Network") : (parsed?.international || parsed?.e164 || "");
  const subtitle = isP2P ? "Free · End-to-end encrypted P2P" : (parsed?.countryName || "Unknown destination");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-background/85 backdrop-blur-md flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="relative w-full max-w-lg"
          >
            <div className="absolute -inset-px rounded-[28px] bg-gradient-to-br from-primary/30 via-info/15 to-transparent blur-xl opacity-60" />
            <div className="relative rounded-3xl border border-border bg-card/95 p-7 shadow-2xl">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  {STATUS_LABEL[state] || state.toUpperCase()}
                </div>

                <div className="relative my-4">
                  <div
                    className={
                      state === "in_call"
                        ? "ring-pulse h-24 w-24 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.7)]"
                        : "h-24 w-24 rounded-full bg-gradient-to-br from-primary/60 to-info/60 flex items-center justify-center"
                    }
                  >
                    {isP2P ? (
                      <NetworkIcon className="h-9 w-9 text-primary-foreground" />
                    ) : parsed?.country ? (
                      <Flag country={parsed.country} size="xl" />
                    ) : (
                      <Volume2 className="h-9 w-9 text-primary-foreground" />
                    )}
                  </div>
                </div>

                <div className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                  {title}
                </div>
                <div className="text-sm text-muted-foreground">{subtitle}</div>

                <div className="mt-3 font-mono text-3xl tabular-nums tracking-tight">
                  {state === "in_call" ? formatDuration(seconds) : "00:00"}
                </div>

                <canvas ref={canvasRef} className="w-full h-12 mt-3" />
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  variant={muted ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-2xl"
                  onClick={() => { setMuted((m) => { const next = !m; onMute(next); return next; }); }}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant={held ? "default" : "outline"}
                  size="icon"
                  className="h-12 w-12 rounded-2xl"
                  onClick={() => { setHeld((h) => { const next = !h; onHold?.(next); return next; }); }}
                  aria-label={held ? "Resume" : "Hold"}
                  disabled={!onHold}
                >
                  {held ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-2xl"
                  disabled={!onDtmf}
                  onClick={() => onDtmf?.("1")}
                >
                  <Hash className="h-5 w-5" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-14 w-14 rounded-2xl"
                  onClick={onHangup}
                  aria-label="Hang up"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </motion.div>
          <audio ref={audioRef} autoPlay playsInline />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
