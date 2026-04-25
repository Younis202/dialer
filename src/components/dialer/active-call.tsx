"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Mic, MicOff, Pause, Play, Hash, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import type { ParsedPhone } from "@/lib/phone";

interface Props {
  open: boolean;
  parsed: ParsedPhone;
  state: string;
  onHangup: () => void;
  onMute: (m: boolean) => void;
  onHold?: (h: boolean) => void;
  onDtmf?: (d: string) => void;
  remoteStream?: MediaStream | null;
}

export function ActiveCall({ open, parsed, state, onHangup, onMute, onHold, onDtmf, remoteStream }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSeconds(0);
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

  // Local mic waveform
  useEffect(() => {
    if (!open || state !== "in_call") return;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let mounted = true;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) return;
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          if (!canvasRef.current || !analyser) return;
          const c = canvasRef.current;
          const cx = c.getContext("2d")!;
          const dpr = window.devicePixelRatio || 1;
          c.width = c.clientWidth * dpr;
          c.height = c.clientHeight * dpr;
          cx.scale(dpr, dpr);
          analyser.getByteFrequencyData(data);
          cx.clearRect(0, 0, c.clientWidth, c.clientHeight);
          const bars = 48;
          const step = Math.floor(data.length / bars);
          const w = c.clientWidth / bars;
          for (let i = 0; i < bars; i++) {
            const v = data[i * step] / 255;
            const h = Math.max(2, v * c.clientHeight * 0.8);
            const grad = cx.createLinearGradient(0, c.clientHeight, 0, c.clientHeight - h);
            grad.addColorStop(0, "hsla(158, 95%, 48%, 0.2)");
            grad.addColorStop(1, "hsla(158, 95%, 48%, 0.95)");
            cx.fillStyle = grad;
            cx.fillRect(i * w + 1, c.clientHeight - h, w - 2, h);
          }
          rafRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (e) {
        // mic blocked
      }
    })();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [open, state]);

  const STATUS_LABEL: Record<string, string> = {
    connecting: "CONNECTING",
    ringing: "RINGING",
    ringing_out: "RINGING",
    in_call: "IN CALL",
    ended: "ENDED",
    failed: "FAILED",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-2xl flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="relative w-full max-w-lg"
          >
            <div className="absolute -inset-px rounded-[28px] bg-gradient-to-br from-primary/30 via-info/20 to-transparent blur-xl opacity-60" />
            <div className="relative rounded-3xl border border-border bg-card/90 backdrop-blur-2xl p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  {STATUS_LABEL[state] || state.toUpperCase()}
                </div>

                <div className="relative my-4">
                  <div className={state === "in_call" ? "ring-pulse h-24 w-24 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center text-3xl shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.7)]" : "h-24 w-24 rounded-full bg-gradient-to-br from-primary/60 to-info/60 flex items-center justify-center text-3xl"}>
                    {parsed.flag || <Volume2 className="h-9 w-9 text-primary-foreground" />}
                  </div>
                </div>

                <div className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                  {parsed.international || parsed.e164}
                </div>
                <div className="text-sm text-muted-foreground">
                  {parsed.countryName || "Unknown destination"}
                </div>

                <div className="mt-4 font-mono text-3xl tabular-nums tracking-tight">
                  {state === "in_call" ? formatDuration(seconds) : "00:00"}
                </div>

                <canvas ref={canvasRef} className="w-full h-12 mt-4" />
              </div>

              <div className="mt-6 flex items-center justify-center gap-3">
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
                >
                  {held ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl">
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
