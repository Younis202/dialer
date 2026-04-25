"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Phone, Plus, MessageSquare, ArrowUpRight, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keypad } from "@/components/dialer/keypad";
import { NumberDisplay } from "@/components/dialer/number-display";
import { CostOptimizer } from "@/components/dialer/cost-optimizer";
import { ActiveCall } from "@/components/dialer/active-call";
import { parsePhone, asYouType } from "@/lib/phone";
import { cheapestProvider } from "@/lib/rates";
import { formatDuration, formatRelative, formatCurrency } from "@/lib/utils";
import { P2PClient } from "@/lib/p2p/peer";
import { toast } from "@/components/ui/sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DialerPage() {
  const [raw, setRaw] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [callState, setCallState] = useState<string>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myHandle, setMyHandle] = useState<string>("");
  const [peers, setPeers] = useState<string[]>([]);
  const peerRef = useRef<P2PClient | null>(null);
  const callStartRef = useRef<number>(0);
  const callIdRef = useRef<number | null>(null);

  const parsed = useMemo(() => parsePhone(raw), [raw]);
  const cheapest = useMemo(() => cheapestProvider(parsed.country || "US"), [parsed.country]);

  const { data: stats } = useSWR<{ todayCalls: number; todayMinutes: number; todaySpend: number; contacts: number }>(
    "/api/stats",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: recent, mutate: refreshRecent } = useSWR<any[]>("/api/calls?limit=8", fetcher, { refreshInterval: 5000 });

  // Init P2P
  useEffect(() => {
    const p = new P2PClient({
      onState: (s) => {
        setCallState(s);
        if (s === "in_call") {
          callStartRef.current = Date.now();
          setCallOpen(true);
        }
        if (s === "ended" || s === "failed") {
          finalizeCall(s);
        }
      },
      onTrack: (stream) => setRemoteStream(stream),
      onMyHandle: (h) => setMyHandle(h),
      onPresence: (p) => setPeers(p),
      onIncoming: (from) => {
        toast(`Incoming P2P call from ${from}`);
        setCallOpen(true);
      },
    });
    p.connect();
    peerRef.current = p;
    return () => p.destroy();
  }, []);

  // Type formatting
  useEffect(() => {
    if (!raw) return;
    if (raw.length > 4 && raw.length < 20) {
      const fmt = asYouType(raw);
      if (fmt && fmt !== raw && raw.startsWith("+")) {
        // keep raw as user typed
      }
    }
  }, [raw]);

  // Keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (/^[0-9*#+]$/.test(e.key)) {
        setRaw((r) => r + e.key);
      } else if (e.key === "Backspace") {
        setRaw((r) => r.slice(0, -1));
      } else if (e.key === "Enter") {
        if (parsed.isValid) startCall();
      } else if (e.key === "Escape") {
        if (callOpen) hangup();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function startCall() {
    if (!parsed.isValid) return;
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toNumber: parsed.e164,
        countryCode: parsed.country,
        countryName: parsed.countryName,
        provider: cheapest.provider,
      }),
    });
    const data = await res.json();
    callIdRef.current = data.id;
    callStartRef.current = Date.now();
    setCallOpen(true);
    setCallState("connecting");
    setTimeout(() => setCallState("ringing"), 600);
    setTimeout(() => setCallState("in_call"), 2000);
    toast("Calling " + parsed.international, { description: `via ${cheapest.provider} · $${cheapest.perMinute.toFixed(4)}/min` });
  }

  function callPeer(handle: string) {
    if (!peerRef.current) return;
    setCallOpen(true);
    setCallState("ringing_out");
    peerRef.current.call(handle);
  }

  async function finalizeCall(finalState: string) {
    const dur = Math.max(0, Math.floor((Date.now() - callStartRef.current) / 1000));
    if (callIdRef.current) {
      await fetch(`/api/calls/${callIdRef.current}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ duration: dur, status: finalState, cost: dur * (cheapest.perMinute / 60) }),
      });
      callIdRef.current = null;
    }
    setTimeout(() => {
      setCallOpen(false);
      setCallState("idle");
      setRemoteStream(null);
      refreshRecent();
    }, 600);
  }

  function hangup() {
    peerRef.current?.hangup();
    finalizeCall("ended");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-6 max-w-[1600px] mx-auto">
      {/* CENTER — DIALER */}
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Dialer</h1>
            <p className="text-sm text-muted-foreground mt-1">Type, paste, or speak — call anywhere on Earth.</p>
          </div>
          {myHandle && (
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Your Handle</span>
              <Badge variant="default" className="font-mono">{myHandle}</Badge>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-info/10 blur-2xl opacity-50 pointer-events-none" />
          <div className="relative glass rounded-3xl p-6 md:p-8 space-y-6">
            <NumberDisplay
              raw={raw}
              parsed={parsed}
              onChange={setRaw}
              onBackspace={() => setRaw((r) => r.slice(0, -1))}
            />

            <Keypad onPress={(d) => setRaw((r) => r + d)} />

            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                size="icon"
                variant="outline"
                className="h-14 w-14 rounded-2xl"
                onClick={() => navigator.clipboard?.readText().then((t) => t && setRaw(t)).catch(() => {})}
                aria-label="Paste"
              >
                <Plus className="h-5 w-5" />
              </Button>

              <motion.button
                whileHover={{ scale: parsed.isValid ? 1.04 : 1 }}
                whileTap={{ scale: 0.96 }}
                disabled={!parsed.isValid}
                onClick={startCall}
                className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary to-success flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)]"
                aria-label="Call"
              >
                {parsed.isValid && (
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-primary/50"
                    animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <Phone className="h-7 w-7 text-primary-foreground" strokeWidth={2.2} />
              </motion.button>

              <Button size="icon" variant="outline" className="h-14 w-14 rounded-2xl" aria-label="SMS">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <CostOptimizerCard parsed={parsed} />
      </div>

      {/* RIGHT — STATS + RECENT */}
      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Calls Today" value={stats?.todayCalls ?? 0} />
          <StatCard label="Minutes" value={stats?.todayMinutes ?? 0} />
          <StatCard label="Spend" value={formatCurrency(stats?.todaySpend ?? 0)} />
          <StatCard label="Contacts" value={stats?.contacts ?? 0} />
        </div>

        <div className="data-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              DIALR Network
            </div>
            <Badge variant="default" className="font-mono">{peers.length} ONLINE</Badge>
          </div>
          {peers.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No peers online. Open this app in another tab to test free P2P calling.
            </div>
          ) : (
            <div className="space-y-1.5">
              {peers.filter((p) => p !== myHandle).slice(0, 5).map((p) => (
                <button
                  key={p}
                  onClick={() => callPeer(p)}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 hover:bg-accent/60 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="font-mono text-xs">{p}</span>
                  </div>
                  <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="data-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Recent Calls
            </div>
            <a href="/history" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              ALL <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          {!recent || recent.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No calls yet</div>
          ) : (
            <div className="space-y-1">
              {recent.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setRaw(c.toNumber)}
                  className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/60 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-card border border-border/40 flex items-center justify-center text-sm">
                    {c.countryCode ? flagEmoji(c.countryCode) : "·"}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-mono truncate">{c.toNumber}</div>
                    <div className="text-[10px] text-muted-foreground">{formatRelative(c.startedAt)} · {formatDuration(c.duration || 0)}</div>
                  </div>
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <ActiveCall
        open={callOpen}
        parsed={parsed}
        state={callState}
        remoteStream={remoteStream}
        onHangup={hangup}
        onMute={(m) => peerRef.current?.mute(m)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="data-card !p-4">
      <div className="stat-label">{label}</div>
      <div className="stat-num mt-1">{value}</div>
    </div>
  );
}

function CostOptimizerCard({ parsed }: { parsed: ReturnType<typeof parsePhone> }) {
  if (!parsed.isValid) return null;
  return (
    <div className="data-card">
      <CostOptimizer country={parsed.country} active="voipms" />
    </div>
  );
}

function flagEmoji(country: string) {
  if (!country || country.length !== 2) return "·";
  const A = 0x1f1e6;
  const codes = [...country.toUpperCase()].map((c) => A + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codes);
}
