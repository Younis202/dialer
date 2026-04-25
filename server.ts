/* Custom Next.js server with WebSocket signaling on /ws */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT ?? "5000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface Peer {
  ws: WebSocket;
  handle: string;
  joinedAt: number;
}

const peers = new Map<string, Peer>();

function genHandle() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `DIALR-${id}`;
}

function broadcastPresence() {
  const list = [...peers.values()].map((p) => p.handle);
  const msg = JSON.stringify({ type: "presence", peers: list });
  for (const p of peers.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

function sendTo(target: string, msg: any) {
  for (const p of peers.values()) {
    if (p.handle === target && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(msg));
      return true;
    }
  }
  return false;
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request error", err);
      res.statusCode = 500;
      res.end("internal error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "");
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    const id = nanoid(12);
    const handle = genHandle();
    peers.set(id, { ws, handle, joinedAt: Date.now() });

    ws.send(JSON.stringify({ type: "welcome", handle }));
    broadcastPresence();

    ws.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const me = peers.get(id);
      if (!me) return;

      switch (msg.type) {
        case "hello":
          ws.send(JSON.stringify({ type: "welcome", handle: me.handle }));
          broadcastPresence();
          break;
        case "p2p_offer":
        case "p2p_answer":
        case "p2p_ice":
        case "p2p_hangup":
        case "p2p_reject":
          if (msg.to) sendTo(msg.to, { ...msg, from: me.handle });
          break;
        case "transcript":
          // Broadcast transcript fragment to all (could be scoped)
          for (const p of peers.values()) {
            if (p.ws.readyState === WebSocket.OPEN && p.handle !== me.handle) {
              p.ws.send(JSON.stringify({ type: "transcript", from: me.handle, text: msg.text }));
            }
          }
          break;
      }
    });

    ws.on("close", () => {
      peers.delete(id);
      broadcastPresence();
    });
  });

  server.listen(port, hostname, () => {
    console.log(`\n  ▲ DIALR ready on http://${hostname}:${port}\n`);
  });
});
