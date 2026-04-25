"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { P2PClient, type P2PState } from "@/lib/p2p/peer";
import { toast } from "@/components/ui/sonner";

interface P2PContextValue {
  client: P2PClient | null;
  myHandle: string;
  peers: string[];
  state: P2PState;
  remoteStream: MediaStream | null;
  incomingFrom: string;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  clearIncoming: () => void;
}

const P2PContext = createContext<P2PContextValue | null>(null);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<P2PClient | null>(null);
  const [myHandle, setMyHandle] = useState("");
  const [peers, setPeers] = useState<string[]>([]);
  const [state, setState] = useState<P2PState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingFrom, setIncomingFrom] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (clientRef.current) return;
    const c = new P2PClient();
    clientRef.current = c;

    const off = c.on({
      onMyHandle: setMyHandle,
      onPresence: setPeers,
      onState: setState,
      onTrack: setRemoteStream,
      onIncoming: (from) => {
        setIncomingFrom(from);
        toast(`Incoming P2P call from ${from}`);
      },
    });

    c.connect();

    return () => {
      off();
      c.destroy();
      clientRef.current = null;
    };
  }, []);

  const value: P2PContextValue = {
    client: clientRef.current,
    myHandle,
    peers,
    state,
    remoteStream,
    incomingFrom,
    acceptIncoming: () => setIncomingFrom(""),
    rejectIncoming: () => {
      clientRef.current?.hangup();
      setIncomingFrom("");
    },
    clearIncoming: () => setIncomingFrom(""),
  };

  return <P2PContext.Provider value={value}>{children}</P2PContext.Provider>;
}

export function useP2P() {
  const ctx = useContext(P2PContext);
  if (!ctx) throw new Error("useP2P must be used inside P2PProvider");
  return ctx;
}
