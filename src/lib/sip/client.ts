"use client";

// JsSIP wrapper. Connects directly to a SIP-WS provider (Voip.ms by default).
// Singleton-friendly: shared by every page via SipProvider context.

export type SipState =
  | "disconnected"
  | "registering"
  | "registered"
  | "connecting"
  | "ringing"
  | "in_call"
  | "ended"
  | "failed";

export interface SipConfig {
  uri: string;
  password: string;
  wsServer: string;
  displayName?: string;
  realm?: string;
}

export interface SipEvents {
  onState?: (s: SipState, info?: any) => void;
  onTrack?: (stream: MediaStream | null) => void;
  onError?: (err: Error) => void;
  onIncoming?: (from: string) => void;
}

export class SipClient {
  private ua: any | null = null;
  private session: any | null = null;
  private listeners = new Set<SipEvents>();
  private currentState: SipState = "disconnected";
  private cfg: SipConfig | null = null;

  on(events: SipEvents) {
    this.listeners.add(events);
    if (this.currentState !== "disconnected") events.onState?.(this.currentState);
    return () => this.listeners.delete(events);
  }

  private emit<K extends keyof SipEvents>(k: K, ...args: any[]) {
    for (const l of this.listeners) {
      const fn = l[k] as any;
      if (fn) fn(...args);
    }
  }

  private setState(s: SipState, info?: any) {
    this.currentState = s;
    this.emit("onState", s, info);
  }

  get state(): SipState { return this.currentState; }
  get config(): SipConfig | null { return this.cfg; }
  get isRegistered() { return this.currentState === "registered" || this.currentState === "in_call" || this.currentState === "ringing"; }

  async connect(cfg: SipConfig) {
    if (typeof window === "undefined") return;
    if (!cfg.uri || !cfg.password || !cfg.wsServer) return;
    // disconnect any previous instance first
    this.disconnect();
    this.cfg = cfg;

    let JsSIP: any;
    try {
      JsSIP = (await import("jssip")).default;
    } catch (err) {
      this.emit("onError", new Error("Failed to load JsSIP"));
      return;
    }

    try {
      const socket = new JsSIP.WebSocketInterface(cfg.wsServer);
      this.ua = new JsSIP.UA({
        sockets: [socket],
        uri: cfg.uri,
        password: cfg.password,
        display_name: cfg.displayName,
        register: true,
        session_timers: false,
        user_agent: "DIALR/2.0",
      });

      this.ua.on("registered", () => this.setState("registered"));
      this.ua.on("unregistered", () => this.setState("disconnected"));
      this.ua.on("registrationFailed", (e: any) => {
        this.setState("failed", e);
        this.emit("onError", new Error(e.cause || "Registration failed"));
      });
      this.ua.on("disconnected", () => this.setState("disconnected"));
      this.ua.on("connecting", () => this.setState("registering"));

      this.ua.on("newRTCSession", (e: any) => {
        if (e.originator !== "remote") return;
        this.session = e.session;
        this.bindSession(this.session);
        const from = (this.session.remote_identity?.uri?.user as string) || "unknown";
        this.emit("onIncoming", from);
        this.setState("ringing");
      });

      this.ua.start();
      this.setState("registering");
    } catch (err: any) {
      this.setState("failed", err);
      this.emit("onError", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private bindSession(session: any) {
    session.on("progress", () => this.setState("ringing"));
    session.on("accepted", () => this.setState("in_call"));
    session.on("confirmed", () => this.setState("in_call"));
    session.on("ended", () => {
      this.setState("ended");
      this.session = null;
      this.emit("onTrack", null);
    });
    session.on("failed", (e: any) => {
      this.setState("failed", e);
      this.session = null;
      this.emit("onTrack", null);
    });

    const pc = session.connection;
    if (pc) {
      pc.addEventListener("track", (ev: RTCTrackEvent) => {
        if (ev.streams[0]) this.emit("onTrack", ev.streams[0]);
      });
    }
  }

  call(target: string) {
    if (!this.ua) throw new Error("SIP not registered");
    this.setState("connecting");

    const session = this.ua.call(target, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    this.session = session;
    this.bindSession(session);
    return session;
  }

  answer() {
    if (!this.session) return;
    try {
      this.session.answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });
    } catch {}
  }

  hangup() {
    if (this.session) {
      try { this.session.terminate(); } catch {}
      this.session = null;
      this.emit("onTrack", null);
    }
  }

  sendDTMF(tone: string) {
    if (this.session) {
      try { this.session.sendDTMF(tone); } catch {}
    }
  }

  mute(muted: boolean) {
    if (!this.session) return;
    try {
      if (muted) this.session.mute({ audio: true });
      else this.session.unmute({ audio: true });
    } catch {}
  }

  hold(held: boolean) {
    if (!this.session) return;
    try {
      if (held) this.session.hold();
      else this.session.unhold();
    } catch {}
  }

  disconnect() {
    this.hangup();
    if (this.ua) {
      try { this.ua.stop(); } catch {}
      this.ua = null;
    }
    this.cfg = null;
    this.setState("disconnected");
  }
}
