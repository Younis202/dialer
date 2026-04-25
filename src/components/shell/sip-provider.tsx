"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { SipClient, type SipState, type SipConfig } from "@/lib/sip/client";
import { toast } from "@/components/ui/sonner";

interface SipContextValue {
  client: SipClient | null;
  state: SipState;
  registered: boolean;
  config: SipConfig | null;
  remoteStream: MediaStream | null;
  incomingFrom: string;
  clearIncoming: () => void;
}

const SipContext = createContext<SipContextValue | null>(null);
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function SipProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSWR<any>("/api/settings", fetcher, { revalidateOnFocus: false });
  const clientRef = useRef<SipClient | null>(null);
  const [state, setState] = useState<SipState>("disconnected");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingFrom, setIncomingFrom] = useState("");
  const lastCfgRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!clientRef.current) {
      const c = new SipClient();
      clientRef.current = c;
      c.on({
        onState: setState,
        onTrack: setRemoteStream,
        onError: (err) => toast.error(`SIP: ${err.message}`),
        onIncoming: (from) => {
          setIncomingFrom(from);
          toast(`Incoming SIP call from ${from}`);
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!settings) return;
    const user = settings.voipmsUser;
    const pass = settings.voipmsPass;
    const server = settings.voipmsServer || "atlanta.voip.ms";
    if (!user || !pass) return;
    const cfg = {
      uri: `sip:${user}@${server}`,
      password: pass,
      wsServer: `wss://${server}:443`,
      displayName: settings.callerId || user,
    };
    const sig = JSON.stringify(cfg);
    if (sig === lastCfgRef.current) return;
    lastCfgRef.current = sig;
    clientRef.current?.connect(cfg);
  }, [settings]);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  const value: SipContextValue = {
    client: clientRef.current,
    state,
    registered: state === "registered" || state === "in_call" || state === "ringing" || state === "connecting",
    config: clientRef.current?.config || null,
    remoteStream,
    incomingFrom,
    clearIncoming: () => setIncomingFrom(""),
  };

  return <SipContext.Provider value={value}>{children}</SipContext.Provider>;
}

export function useSip() {
  const ctx = useContext(SipContext);
  if (!ctx) throw new Error("useSip must be used inside SipProvider");
  return ctx;
}
