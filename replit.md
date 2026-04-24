# DIALR PRO

A Flask + WebRTC dialer web app that integrates with Twilio (or Voip.ms) for low-cost outbound calling. The browser uses Twilio's JavaScript SDK to place calls; the Flask backend issues access tokens, handles TwiML voice webhooks, tracks call status, and exposes simple REST/WebSocket APIs.

## Stack

- **Backend:** Python 3.12, Flask, Flask-SocketIO
- **Telephony:** Twilio (Voice + WebRTC)
- **Realtime:** Socket.IO over WebSockets (`simple-websocket`)
- **Frontend:** Single-page `templates/index.html` (Twilio JS SDK + Socket.IO client via CDN)
- **Persistence:** In-memory `call_log` and `stats`; contacts stored in `contacts.json`

## Project Layout

```
app.py                # Flask app + routes + Socket.IO events
templates/index.html  # UI (rendered by Flask via Jinja)
env.example           # Sample env vars (Twilio credentials)
pyproject.toml        # uv-managed Python deps
```

## Running Locally

The workflow `Start application` runs `python app.py` on `0.0.0.0:5000` (webview).

## Environment Variables

Optional — the app starts without them but Twilio features will be disabled until they are set. See `env.example`:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`
- `SECRET_KEY`

## Deployment

Configured for **VM** deployment (`python app.py`) because the app keeps in-memory call/stat state and uses long-lived WebSocket connections.

## Replit Setup Notes

- Moved `index.html` into `templates/` so Flask's default loader can find it.
- Bound to `0.0.0.0:5000` for the Replit webview proxy.
- `flask-socketio` requires `simple-websocket` for the WebSocket transport — installed alongside the other deps.
