# DIALR PRO — World Dialer

A legendary, no-compromise web dialer + CRM. Built with Flask · SQLite · Socket.IO · WebRTC · Three.js.

## ⚡ The Big Differentiators

| Feature | What it does |
|---------|-------------|
| **DIALR Network (P2P)** | Real WebRTC browser-to-browser calls. **$0.00/min, unlimited, anywhere on Earth.** Every browser session gets a `DIALR-XXXXXX` handle — share it, get called for free, forever. Audio + video. |
| **3D World Map** | A spinning Three.js earth (atmosphere shader + graticule + ~200 country dots) with glowing arcs flying from your origin to every call destination. Drag to rotate, scroll to zoom. |
| **AI Assistant** | Floating button. Anthropic Claude (`claude-haiku-4-5`) when `ANTHROPIC_API_KEY` is set; falls back to a smart heuristic engine. Summarises calls, coaches you live based on the running transcript. |
| **Cost Optimizer** | The moment you type a number, the dialer queries every configured provider, sorts by per-minute cost for that country, and highlights the cheapest path. |
| **Voice Commands** | Click 🎤 to enable. Say "DIALR call +20 100…" to dial, "DIALR network" to switch tab, etc. Auto-detects Arabic vs English from the language switcher. |
| **Live mic waveform** | Frequency-bar visualiser via Web Audio API, drawn during every active call. |
| **Arabic / RTL** | Top-right `EN / عربي` switch flips the entire layout to RTL and translates the nav. |
| **PWA install** | `manifest.json` + service worker. Installable on Chrome/Edge/Safari. Works offline (shell). |
| **Animated network background** | Subtle particle/connection canvas overlay tying the whole UI together. |

## CRM Surface (12 pages)

Dialer · Power Dialer · DIALR Network · World Map · Contacts · Lists · Call History · SMS · Scheduled · Scripts · Voicemail Drop · Analytics · DNC · Settings.

Active call panel includes: live transcript (Web Speech API), notes, disposition picker, in-call scripts, mic waveform.

## Providers

| Provider | Use it for | Required env |
|----------|------------|--------------|
| **Demo** | Works out of the box, fakes calls/SMS — perfect for testing. | none |
| **Twilio** | Production-grade global PSTN + SMS, plus browser WebRTC. | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (+ `TWILIO_API_KEY` / `TWILIO_API_SECRET` / `TWILIO_TWIML_APP_SID` for browser dialing) |
| **Voip.ms** | Cheapest PSTN rates worldwide. | `VOIPMS_USERNAME`, `VOIPMS_PASSWORD`, `VOIPMS_DID` |
| **DIALR Network** | Built-in. Free P2P WebRTC between any two DIALR sessions. | none |

Active provider is chosen in **Settings → Provider**. The cost optimizer sorts all configured providers automatically per call.

## Stack

- **Backend:** Python 3, Flask, Flask-SocketIO (threading mode + simple-websocket), SQLite (`dialr.db`).
- **Phone parsing:** `phonenumbers` (Google libphonenumber port) for E.164, country, type, cost estimation.
- **AI:** Anthropic Messages API (HTTP, no SDK) with heuristic fallback.
- **Realtime:** Socket.IO over polling (websocket transport disabled to avoid a werkzeug dev-server bug on upgrade). Carries P2P signaling (`p2p_offer/answer/ice/hangup`) and live transcript broadcasts.
- **Frontend:** vanilla JS (no framework), Chart.js for analytics, Three.js for the globe, Web Audio API for waveform, Web Speech API for transcription + voice commands.
- **WebRTC:** Google STUN servers; PeerConnection per call. Audio/video both supported.
- **Auth:** none — single-user app meant to run for one operator.

## Project Structure

```
app.py              # REST routes + Socket.IO (incl. WebRTC P2P signaling, AI, geo, cost)
realtime.py         # P2P presence, AI assistant (Claude + heuristic), cost optimizer
geo.py              # Compact ISO country → (lat, lng, capital) table for the globe
db.py               # SQLite schema + helpers
providers.py        # Twilio / Voip.ms / Demo abstraction
templates/
  index.html        # Single-page UI shell (14 sections)
static/
  styles.css        # Dark CRM theme + legendary additions (RTL, AI panel, globe)
  app.js            # Client-side logic — IIFE + legendary extension module
  globe.js          # Three.js 3D globe (init / addCallArc / loadFromCallsData)
  icon.svg          # PWA icon
  sw.js (served)    # Service worker (cached shell)
uploads/            # User-uploaded voicemails
dialr.db            # SQLite database (auto-created)
env.example         # Reference for env vars
```

## Run

```
python app.py
```

The Replit workflow `Start application` does this on port 5000.

## Deploy

Configured for **VM** deployment (keeps Socket.IO connections + in-memory P2P presence alive between requests).

## Keyboard / Voice Shortcuts

`Alt+1..9` switch tabs · `0-9` dial keys · `Enter` place call · `Esc` close modal.

Voice (after enabling 🎤): "DIALR call +20…" · "DIALR network" · "DIALR contacts" · "DIALR hang up".

## Important env vars

- `ANTHROPIC_API_KEY` — enables the live AI coach + summary (Claude). Without it, falls back to heuristic.
- `ANTHROPIC_MODEL` — defaults to `claude-haiku-4-5`.
- Provider creds — see table above.

## Notes

- Socket.IO uses polling-only transport. Don't switch to websocket without addressing the werkzeug `write() before start_response` bug.
- `parse_phone()` returns variable-length tuples — callers use the `if len(res) >= N` pattern defensively.
- The 3D globe loads `three@0.160` from jsDelivr; the deprecation warning about `build/three.min.js` is informational only — it still works.
