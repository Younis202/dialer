"""Realtime layer for DIALR PRO:

  • WebRTC P2P signaling (free browser-to-browser unlimited calls)
  • Online presence (DIALR Network)
  • AI assistant (Anthropic if ANTHROPIC_API_KEY else local heuristic)
  • Cost optimizer (chooses cheapest provider per destination)
"""
import os, time, json, urllib.request

# ── Presence registry ───────────────────────────────────
# sid -> {handle, country, joined_at}
PEERS = {}

def register_peer(sid, handle, country=""):
    PEERS[sid] = {"handle": handle or sid[:6], "country": country,
                  "joined_at": int(time.time()), "in_call": False}

def unregister_peer(sid):
    PEERS.pop(sid, None)

def list_peers(exclude_sid=None):
    return [{"sid": s, **p} for s, p in PEERS.items() if s != exclude_sid]

def find_peer_by_handle(handle):
    for sid, p in PEERS.items():
        if p["handle"].lower() == (handle or "").lower():
            return sid, p
    return None, None

def set_in_call(sid, in_call=True):
    if sid in PEERS:
        PEERS[sid]["in_call"] = in_call


# ── Cost optimizer ──────────────────────────────────────
def optimize_route(country_code, providers_dict):
    """Return list of providers sorted cheapest first (only configured ones)."""
    out = []
    for name, p in providers_dict.items():
        if not p.configured():
            continue
        try:
            cost = p.per_minute_cost(country_code or "US")
        except Exception:
            cost = 999
        out.append({"name": name, "cost_per_min": round(cost, 4)})
    out.sort(key=lambda x: x["cost_per_min"])
    return out


# ── AI Assistant ────────────────────────────────────────
def _has_anthropic():
    return bool(os.getenv("ANTHROPIC_API_KEY"))

def _anthropic_call(system, user, max_tokens=600):
    """Call Claude via the Messages API. Returns text or None on failure."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    body = json.dumps({
        "model": os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5"),
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
            blocks = data.get("content", [])
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    except Exception as e:
        return f"[AI error: {e}]"


def ai_summarize(transcript, contact=None, duration=0):
    """Summarize a call. Falls back to a deterministic outline."""
    if _has_anthropic() and transcript:
        sys = ("You are an elite sales-call assistant. Summarize the call in 4 short sections: "
               "Outcome, Key points, Objections raised, Next action. Use bullet points and Arabic+English mix where helpful.")
        usr = f"Contact: {contact or 'unknown'}\nDuration: {duration}s\n\nTranscript:\n{transcript[:8000]}"
        return _anthropic_call(sys, usr) or _heuristic_summary(transcript, contact, duration)
    return _heuristic_summary(transcript, contact, duration)


def _heuristic_summary(transcript, contact, duration):
    if not transcript:
        return "• No transcript captured.\n• Suggested next action: send a follow-up SMS."
    words = transcript.split()
    wc = len(words)
    sentences = [s.strip() for s in transcript.replace("\n", " ").split(".") if s.strip()][:5]
    return ("• Spoke for ~{}m {}s with {} ({} words transcribed).\n"
            "• Key snippets:\n  – {}\n"
            "• Suggested next action: schedule a follow-up in 3 days.").format(
        duration // 60, duration % 60, contact or "the contact", wc,
        "\n  – ".join(sentences) if sentences else "(none)",
    )


def ai_coach(transcript, contact=None):
    """Live in-call coaching. Suggests next-best questions."""
    if _has_anthropic() and transcript:
        sys = ("You are a real-time call coach. Read the latest transcript and suggest the next 3 best things "
               "the agent should say or ask. Be punchy: max 1 line each, no preamble.")
        usr = f"Contact: {contact or 'unknown'}\n\nLatest transcript:\n{transcript[-3000:]}"
        return _anthropic_call(sys, usr, max_tokens=300) or _heuristic_coach(transcript)
    return _heuristic_coach(transcript)


def _heuristic_coach(transcript):
    t = (transcript or "").lower()
    tips = []
    if "price" in t or "cost" in t or "expensive" in t:
        tips.append("Anchor on value, not price — restate the ROI.")
    if "think about" in t or "let me think" in t or "get back" in t:
        tips.append("Lock a time: 'When's a good moment Thursday or Friday?'")
    if "interested" in t or "sounds good" in t:
        tips.append("Close: 'Great — should I send the agreement now?'")
    if "no" in t.split()[-30:]:
        tips.append("Reframe: 'What would need to be true for this to make sense?'")
    if not tips:
        tips = ["Ask an open question: 'What's the biggest issue this would solve for you?'",
                "Mirror their last 2 words to keep them talking.",
                "Confirm timeline: 'When would you ideally want this live?'"]
    return "\n".join(f"→ {t}" for t in tips[:3])
