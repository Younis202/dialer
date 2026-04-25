"use client";

// JsSIP wrapper for browser-side SIP. Connects directly to Voip.ms (or any SIP-WS provider).
// No backend SIP proxy needed.

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
  uri: string;            // sip:USER@atlanta1.voip.ms
  password: string;
  wsServer: string;       // wss://atlanta1.voip.ms:443
  displayName?: string;
  realm?: string;         // optional, defaults to host part
}

export interface SipEvents {
  onState?: (s: SipState, info?: any) => void;
  onTrack?: (stream: MediaStream) => void;
  onError?: (err: Error) => void;
}

export class SipClient {
  private ua: any | null = null;
  private session: any | null = null;
  private events: SipEvents;
  private currentState: SipState = "disconnected";

  constructor(events: SipEvents = {}) {
    this.events = events;
  }

  private setState(s: SipState, info?: any) {
    this.currentState = s;
    this.events.onState?.(s, info);
  }

  get state(): SipState {
    return this.currentState;
  }

  async connect(cfg: SipConfig) {
    if (typeof window === "undefined") return;
    const JsSIP = (await import("jssip")).default;

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
    this.ua.on("registrationFailed", (e: any) => {
      this.setState("failed", e);
      this.events.onError?.(new Error(e.cause || "Registration failed"));
    });
    this.ua.on("disconnected", () => this.setState("disconnected"));
    this.ua.on("connecting", () => this.setState("registering"));

    this.ua.start();
  }

  call(target: string) {
    if (!this.ua) throw new Error("SIP not connected");
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

    session.on("progress", () => this.setState("ringing"));
    session.on("accepted", () => this.setState("in_call"));
    session.on("confirmed", () => this.setState("in_call"));
    session.on("ended", () => {
      this.setState("ended");
      this.session = null;
    });
    session.on("failed", (e: any) => {
      this.setState("failed", e);
      this.session = null;
    });

    session.connection?.addEventListener("track", (ev: RTCTrackEvent) => {
      if (ev.streams[0]) this.events.onTrack?.(ev.streams[0]);
    });

    return session;
  }

  hangup() {
    if (this.session) {
      try { this.session.terminate(); } catch {}
      this.session = null;
    }
  }

  sendDTMF(tone: string) {
    if (this.session) {
      try { this.session.sendDTMF(tone); } catch {}
    }
  }

  mute(muted: boolean) {
    if (!this.session) return;
    if (muted) this.session.mute({ audio: true });
    else this.session.unmute({ audio: true });
  }

  hold(held: boolean) {
    if (!this.session) return;
    if (held) this.session.hold();
    else this.session.unhold();
  }

  disconnect() {
    this.hangup();
    if (this.ua) {
      try { this.ua.stop(); } catch {}
      this.ua = null;
    }
    this.setState("disconnected");
  }
}
