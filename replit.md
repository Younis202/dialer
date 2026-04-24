# DIALR PRO

A professional world dialer / mini-CRM web app built with Flask + SQLite + Socket.IO.

## What it does

- **Dialer** — international keypad with live cost lookup (per-country pricing).
- **Power Dialer** — auto-dial through any contact list, with progress, dispositions, skip & stop.
- **Contacts** — full CRUD, CSV import / export, tags, company, country auto-detect.
- **Lists** — group contacts into colored campaigns.
- **History** — every call recorded; per-call notes, transcript, disposition.
- **Live Transcription** — uses the browser Web Speech API on the active call.
- **SMS** — two-way messaging with threaded conversations.
- **Scheduled Callbacks** — pick a date/time, gets flagged when due.
- **Scripts** — categorized talk-tracks shown in the live call panel.
- **Voicemail Drop** — record audio in the browser & save for re-use.
- **Analytics** — calls/cost charts (Chart.js), top contacts, disposition mix.
- **Do Not Call** — block numbers from being dialed.
- **Settings** — pick provider, manage agent identity, edit dispositions.

## Providers

The backend has an abstraction over three providers (`providers.py`):

| Provider | Use it for | Required env |
|----------|------------|--------------|
| **Demo** | Works out of the box, fakes calls/SMS — perfect for testing the UI. | none |
| **Twilio** | Production-grade global calls + SMS, plus browser WebRTC voice. | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (optionally `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID` for browser dialing) |
| **Voip.ms** | Cheapest international rates. | `VOIPMS_USERNAME`, `VOIPMS_PASSWORD`, `VOIPMS_DID` |

Active provider is chosen in **Settings → Provider** (auto / twilio / voipms / demo).

## Stack

- **Backend:** Python 3, Flask, Flask-SocketIO (threading mode + simple-websocket), SQLite (`dialr.db`).
- **Phone parsing:** `phonenumbers` (Google libphonenumber port) for E.164, country, type & cost estimation.
- **Frontend:** vanilla JS (no framework), Chart.js, Socket.IO. Single-page with hash-less navigation.
- **Realtime:** Socket.IO over polling (websocket transport disabled to avoid a werkzeug dev-server bug on upgrade).
- **Auth:** none — single-user app meant to run for one operator.

## Project Structure

```
app.py              # Flask routes (REST + Socket.IO)
db.py               # SQLite schema + helpers + seed data
providers.py        # Twilio / Voip.ms / Demo abstraction
templates/
  index.html        # Single-page UI shell
static/
  styles.css        # Dark CRM theme
  app.js            # All client-side logic
uploads/            # User-uploaded voicemails
dialr.db            # SQLite database (auto-created)
env.example         # Reference for env vars
```

## Run

```
python app.py
```

The Replit workflow `Start application` does this automatically and exposes port 5000.

## Deploy

Configured for **VM** deployment (keeps Socket.IO connections + in-memory call state alive between requests).

## Keyboard Shortcuts

`Alt+1..9` switch tabs · `0-9` dial keys · `Enter` place call · `Esc` close modal.
