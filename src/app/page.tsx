"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Phone, Plus, MessageSquare, ArrowUpRight, Wifi, Copy, Check, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keypad } from "@/components/dialer/keypad";
import { NumberDisplay } from "@/components/dialer/number-display";
import { CostOptimizer } from "@/components/dialer/cost-optimizer";
import { ActiveCall } from "@/components/dialer/active-call";
import { Flag } from "@/components/ui/flag";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parsePhone } from "@/lib/phone";
import { cheapestProvider } from "@/lib/rates";
import { formatDuration, formatRelative, formatCurrency } from "@/lib/utils";
import { useP2P } from "@/components/shell/p2p-provider";
import { useSip } from "@/components/shell/sip-provider";
import { toast } from "@/components/ui/sonner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Mode = "idle" | "telephony" | "p2p";

export default function DialerPage() {
  return <DialerInner />;
}

function DialerInner() {
  const [raw, setRaw] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [copiedHandle, setCopiedHandle] = useState(false);

  const callStartRef = useRef<number>(0);
  const callIdRef = useRef<number | null>(null);
  const callerCcRef = useRef<string>("US");

  const sip = useSip();
  const p2p = useP2P();

  const parsed = useMemo(() => parsePhone(raw), [raw]);
  const cheapest = useMemo(() => cheapestProvider(parsed.country || "US"), [parsed.country]);

  const { data: stats } = useSWR<{
    todayCalls: number; todayMinutes: number; todaySpend: number; contacts: number;
  }>("/api/stats", fetcher, { refreshInterval: 15000 });

  const { data: recent, mutate: refreshRecent } = useSWR<any[]>("/api/calls?limit=8", fetcher, {
    refreshInterval: 8000,
  });

  // Pre-fill from `?dial=` query param (client-only, no useSearchParams needed)
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("dial");
    if (d) {
      setRaw(d);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // SIP state -> UI state
  useEffect(() => {
    if (mode !== "telephony") return;
    const s = sip.state;
    if (s === "in_call") {
      callStartRef.current = Date.now();
      setCallOpen(true);
    }
    if (s === "ended" || s === "failed" || s === "disconnected") {
      finalizeCall(s, "telephony");
    }
  }, [sip.state, mode]); // eslint-disable-line

  // P2P state -> UI state
  useEffect(() => {
    if (mode !== "p2p") return;
    const s = p2p.state;
    if (s === "in_call") {
      callStartRef.current = Date.now();
      setCallOpen(true);
    }
    if (s === "ended" || s === "failed") {
      finalizeCall(s, "p2p");
    }
  }, [p2p.state, mode]); // eslint-disable-line

  // Keyboard input — only when not in inputs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (callOpen && e.key === "Escape") { hangup(); return; }
      if (callOpen) return;
      if (/^[0-9*#+]$/.test(e.key)) {
        setRaw((r) => r + e.key);
      } else if (e.key === "Backspace") {
        setRaw((r) => r.slice(0, -1));
      } else if (e.key === "Enter") {
        if (parsed.isValid) startCall();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [callOpen, parsed.isValid]); // eslint-disable-line

  async function startCall() {
    if (!parsed.isValid) return;
    callerCcRef.current = parsed.country;

    // Create the call row first so we have an id even if SIP fails
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toNumber: parsed.e164,
        countryCode: parsed.country,
        countryName: parsed.countryName,
        provider: sip.registered ? "voipms" : cheapest.provider,
      }),
    });
    if (res.status === 403) {
      toast.error("Number is on your DNC list");
      return;
    }
    const data = await res.json();
    callIdRef.current = data?.id ?? null;
    callStartRef.current = Date.now();

    setMode("telephony");
    setCallOpen(true);

    if (sip.registered && sip.client) {
      try {
        sip.client.call(parsed.e164);
        toast(`Calling ${parsed.international}`, {
          description: `via ${sip.config?.uri?.includes("voip.ms") ? "Voip.ms" : "SIP"}`,
        });
        return;
      } catch (err: any) {
        toast.error(`Call failed: ${err?.message || "unknown"}`);
      }
    } else {
      toast.error("SIP not registered. Configure in Settings to place real calls.");
      // close the placeholder
      setTimeout(() => {
        setCallOpen(false);
        setMode("idle");
        finalizeCall("failed", "telephony");
      }, 1500);
    }
  }

  function callPeer(handle: string) {
    if (!p2p.client) return;
    setMode("p2p");
    setCallOpen(true);
    p2p.client.call(handle);
    toast(`Calling ${handle}`, { description: "Free P2P · End-to-end encrypted" });
  }

  async function finalizeCall(finalState: string, modeUsed: Mode) {
    const dur = Math.max(0, Math.floor((Date.now() - callStartRef.current) / 1000));
    const cost = modeUsed === "p2p" ? 0 : dur * (cheapest.perMinute / 60);
    if (callIdRef.current) {
      try {
        await fetch(`/api/calls/${callIdRef.current}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ duration: dur, status: finalState, cost, endedAt: Date.now() }),
        });
      } catch {}
      callIdRef.current = null;
    }
    setTimeout(() => {
      setCallOpen(false);
      setMode("idle");
      refreshRecent();
    }, 600);
  }

  function hangup() {
    if (mode === "p2p") p2p.client?.hangup();
    else sip.client?.hangup();
    finalizeCall("ended", mode);
  }

  async function sendSms() {
    if (!parsed.isValid || !smsBody.trim()) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toNumber: parsed.e164, body: smsBody }),
    });
    if (res.ok) {
      toast.success("Message sent");
      setSmsBody("");
      setSmsOpen(false);
    } else {
      toast.error("Failed to send. Check Voip.ms API in Settings.");
    }
  }

  function copyHandle() {
    if (!p2p.myHandle) return;
    navigator.clipboard.writeText(p2p.myHandle);
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 1500);
  }

  const callState =
    mode === "p2p" ? p2p.state : mode === "telephony" ? sip.state : "idle";
  const remoteStream =
    mode === "p2p" ? p2p.remoteStream : mode === "telephony" ? sip.remoteStream : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-6 max-w-[1600px] mx-auto">
      {/* CENTER — DIALER */}
      <div className="space-y-6 min-w-0">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Dialer</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Type, paste, or speak — call anywhere on Earth.
            </p>
          </div>
          {p2p.myHandle && (
            <button
              onClick={copyHandle}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 hover:bg-card/80 transition-colors"
            >
              <Wifi className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Your Handle
              </span>
              <span className="font-mono text-xs font-semibold">{p2p.myHandle}</span>
              {copiedHandle ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
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
                onClick={() =>
                  navigator.clipboard?.readText().then((t) => t && setRaw(t)).catch(() => {})
                }
                aria-label="Paste"
              >
                <Plus className="h-5 w-5" />
              </Button>

              <button
                type="button"
                disabled={!parsed.isValid}
                onClick={startCall}
                className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary to-success flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)] transition-transform hover:enabled:scale-[1.04] active:enabled:scale-95"
                aria-label="Call"
              >
                {parsed.isValid && (
                  <span
                    className="absolute inset-0 rounded-full border-2 border-primary/50 pulse-ring pointer-events-none"
                    aria-hidden
                  />
                )}
                <Phone className="h-7 w-7 text-primary-foreground" strokeWidth={2.2} />
              </button>

              <Button
                size="icon"
                variant="outline"
                className="h-14 w-14 rounded-2xl"
                aria-label="SMS"
                disabled={!parsed.isValid}
                onClick={() => setSmsOpen(true)}
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {parsed.isValid && (
          <div className="data-card">
            <CostOptimizer
              country={parsed.country}
              active={sip.registered ? "voipms" : "voipms"}
            />
          </div>
        )}
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
            <Badge variant="default" className="font-mono">
              {p2p.peers.filter((x) => x !== p2p.myHandle).length} ONLINE
            </Badge>
          </div>
          {p2p.peers.filter((x) => x !== p2p.myHandle).length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No peers online. Open this app in another tab to test free P2P calling.
            </div>
          ) : (
            <div className="space-y-1.5">
              {p2p.peers.filter((x) => x !== p2p.myHandle).slice(0, 5).map((peer) => (
                <button
                  key={peer}
                  onClick={() => callPeer(peer)}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 hover:bg-accent/60 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="font-mono text-xs">{peer}</span>
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
            <a
              href="/history"
              className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
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
                  <div className="h-8 w-8 rounded-lg bg-card border border-border/40 flex items-center justify-center">
                    <Flag country={c.countryCode} size="sm" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-mono truncate">{c.toNumber}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatRelative(c.startedAt)} · {formatDuration(c.duration || 0)}
                    </div>
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
        variant={mode === "p2p" ? "p2p" : "telephony"}
        onHangup={hangup}
        onMute={(m) => (mode === "p2p" ? p2p.client?.mute(m) : sip.client?.mute(m))}
        onHold={mode === "p2p" ? undefined : (h) => sip.client?.hold(h)}
        onDtmf={mode === "p2p" ? undefined : (d) => sip.client?.sendDTMF(d)}
      />

      {/* SMS dialog */}
      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag country={parsed.country} size="sm" />
              <span className="font-mono">{parsed.international || raw}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder="Hello…"
              rows={5}
              maxLength={1600}
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>SMS via Voip.ms</span>
              <span>{smsBody.length}/1600</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsOpen(false)}>Cancel</Button>
            <Button onClick={sendSms}>
              <Send className="h-3.5 w-3.5 mr-1.5" />Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
