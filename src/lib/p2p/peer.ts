"use client";

// WebRTC P2P client. Signaling goes over our /ws WebSocket server.
// Singleton-friendly: one instance per browser tab, shared by every page via context.

export type P2PState =
  | "idle"
  | "connecting"
  | "ringing_out"
  | "ringing_in"
  | "in_call"
  | "ended"
  | "failed";

export interface P2PEvents {
  onState?: (s: P2PState, info?: any) => void;
  onTrack?: (stream: MediaStream | null) => void;
  onIncoming?: (from: string) => void;
  onPresence?: (peers: string[]) => void;
  onMyHandle?: (handle: string) => void;
}

const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export class P2PClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private state: P2PState = "idle";
  private listeners = new Set<P2PEvents>();
  private myHandle = "";
  private peerHandle = "";
  private peers: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  on(events: P2PEvents) {
    this.listeners.add(events);
    // replay current state
    if (this.myHandle) events.onMyHandle?.(this.myHandle);
    if (this.peers.length) events.onPresence?.(this.peers);
    return () => this.listeners.delete(events);
  }

  private emit<K extends keyof P2PEvents>(k: K, ...args: any[]) {
    for (const l of this.listeners) {
      const fn = l[k] as any;
      if (fn) fn(...args);
    }
  }

  get currentState(): P2PState { return this.state; }
  get handle(): string { return this.myHandle; }
  get presence(): string[] { return this.peers; }

  private setState(s: P2PState, info?: any) {
    this.state = s;
    this.emit("onState", s, info);
  }

  connect(wsUrl?: string) {
    if (this.destroyed) return;
    const url =
      wsUrl ??
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
        : "");
    if (!url) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.ws = new WebSocket(url);
    this.ws.onmessage = (ev) => this.handleMessage(ev.data);
    this.ws.onopen = () => this.send({ type: "hello" });
    this.ws.onclose = () => {
      this.ws = null;
      if (this.destroyed) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };
    this.ws.onerror = () => {};
  }

  private send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleMessage(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case "welcome":
        this.myHandle = msg.handle;
        this.emit("onMyHandle", msg.handle);
        break;
      case "presence":
        this.peers = msg.peers ?? [];
        this.emit("onPresence", this.peers);
        break;
      case "p2p_offer":
        this.peerHandle = msg.from;
        this.emit("onIncoming", msg.from);
        await this.handleOffer(msg.from, msg.sdp);
        break;
      case "p2p_answer":
        if (this.pc) await this.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        break;
      case "p2p_ice":
        if (this.pc && msg.candidate) {
          try { await this.pc.addIceCandidate(msg.candidate); } catch {}
        }
        break;
      case "p2p_hangup":
        this.cleanup();
        this.setState("ended");
        break;
    }
  }

  private async setupPC(target: string) {
    this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.peerHandle = target;

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ type: "p2p_ice", to: target, candidate: e.candidate.toJSON() });
    };
    this.pc.ontrack = (e) => {
      if (e.streams[0]) this.emit("onTrack", e.streams[0]);
    };
    this.pc.onconnectionstatechange = () => {
      const st = this.pc?.connectionState;
      if (st === "connected") this.setState("in_call");
      if (st === "failed" || st === "disconnected" || st === "closed") {
        if (this.state === "in_call") {
          this.setState("ended");
          this.cleanup();
        }
      }
    };

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.localStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.localStream!));
  }

  async call(target: string) {
    if (this.state !== "idle" && this.state !== "ended") return;
    this.setState("ringing_out");
    try {
      await this.setupPC(target);
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
      this.send({ type: "p2p_offer", to: target, sdp: offer.sdp });
    } catch (err) {
      this.setState("failed", err);
      this.cleanup();
    }
  }

  private async handleOffer(from: string, sdp: string) {
    this.setState("ringing_in");
    try {
      await this.setupPC(from);
      await this.pc!.setRemoteDescription({ type: "offer", sdp });
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      this.send({ type: "p2p_answer", to: from, sdp: answer.sdp });
    } catch (err) {
      this.setState("failed", err);
      this.cleanup();
    }
  }

  hangup() {
    if (this.peerHandle) this.send({ type: "p2p_hangup", to: this.peerHandle });
    this.cleanup();
    this.setState("ended");
  }

  private cleanup() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    this.peerHandle = "";
    this.emit("onTrack", null);
  }

  mute(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  destroy() {
    this.destroyed = true;
    this.cleanup();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}
