"""
╔══════════════════════════════════════════════════════════╗
║         DIALR PRO — أرخص dialer في الكون               ║
║   Stack: Python Flask + WebRTC + Voip.ms SIP Trunk      ║
║   تكلفة: ~$0.01/دقيقة لمعظم دول العالم                 ║
╚══════════════════════════════════════════════════════════╝

متطلبات التشغيل:
  pip install flask flask-socketio twilio requests python-dotenv

أو لو عاوز Voip.ms بدل Twilio:
  نفس الكود - بس غير الـ credentials في .env
"""

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Dial
import os, json, datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dialr-secret-2024")
socketio = SocketIO(app, cors_allowed_origins="*")

# ── Twilio / Voip.ms credentials من .env ──
TWILIO_SID    = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN  = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")  # رقمك الأمريكي

client = Client(TWILIO_SID, TWILIO_TOKEN) if TWILIO_SID else None

# ── Call log في الذاكرة (ممكن تبدله بـ SQLite) ──
call_log = []
stats = {"total_calls": 0, "total_minutes": 0, "total_cost": 0.0}

# ══════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════

@app.route("/")
def index():
    return render_template("index.html",
                           my_number=TWILIO_NUMBER or "+1 (000) 000-0000")

@app.route("/token", methods=["GET"])
def get_token():
    """بيعمل WebRTC token عشان المتصفح يقدر يتصل مباشرة."""
    from twilio.jwt.access_token import AccessToken
    from twilio.jwt.access_token.grants import VoiceGrant

    token = AccessToken(TWILIO_SID, TWILIO_TOKEN,
                        os.getenv("TWILIO_API_KEY"),
                        identity="dialr_user",
                        ttl=3600)
    voice_grant = VoiceGrant(
        outgoing_application_sid=os.getenv("TWILIO_TWIML_APP_SID"),
        incoming_allow=True
    )
    token.add_grant(voice_grant)
    return jsonify({"token": token.to_jwt()})

@app.route("/voice", methods=["POST"])
def voice():
    """Twilio بيكلم الـ endpoint ده لما فيه call."""
    to_number = request.form.get("To", "")
    response = VoiceResponse()

    if to_number and to_number.startswith("+"):
        dial = Dial(caller_id=TWILIO_NUMBER,
                    record="record-from-answer",
                    timeout=30)
        dial.number(to_number)
        response.append(dial)
    else:
        response.say("Invalid number.", voice="alice")

    return str(response), 200, {"Content-Type": "text/xml"}

@app.route("/call/status", methods=["POST"])
def call_status():
    """Twilio بيبعت status updates هنا."""
    status    = request.form.get("CallStatus")
    duration  = int(request.form.get("CallDuration", 0))
    to_num    = request.form.get("To", "")
    from_num  = request.form.get("From", "")
    call_sid  = request.form.get("CallSid", "")
    cost      = round(duration / 60 * 0.015, 4)  # ~$0.015/min تقريبي

    entry = {
        "sid":      call_sid,
        "to":       to_num,
        "from":     from_num,
        "status":   status,
        "duration": duration,
        "cost":     cost,
        "time":     datetime.datetime.now().strftime("%H:%M:%S"),
        "date":     datetime.datetime.now().strftime("%Y-%m-%d"),
    }
    call_log.insert(0, entry)
    if len(call_log) > 500:
        call_log.pop()

    if status == "completed":
        stats["total_calls"]   += 1
        stats["total_minutes"] += round(duration / 60, 2)
        stats["total_cost"]    += cost
        socketio.emit("call_ended", entry)

    return "", 204

@app.route("/api/log")
def api_log():
    return jsonify(call_log[:50])

@app.route("/api/stats")
def api_stats():
    return jsonify(stats)

@app.route("/api/contacts", methods=["GET", "POST"])
def api_contacts():
    """بسيط — contacts في ملف JSON."""
    contacts_file = "contacts.json"
    if request.method == "GET":
        if os.path.exists(contacts_file):
            with open(contacts_file) as f:
                return jsonify(json.load(f))
        return jsonify([])
    data = request.get_json()
    existing = []
    if os.path.exists(contacts_file):
        with open(contacts_file) as f:
            existing = json.load(f)
    existing.append(data)
    with open(contacts_file, "w") as f:
        json.dump(existing, f)
    return jsonify({"ok": True})

# ══════════════════════════════════════════════════
#  SOCKET EVENTS
# ══════════════════════════════════════════════════

@socketio.on("connect")
def on_connect():
    emit("stats_update", stats)

@socketio.on("request_stats")
def on_stats():
    emit("stats_update", stats)

# ══════════════════════════════════════════════════
if __name__ == "__main__":
    print("""
  ╔══════════════════════════════════╗
  ║   DIALR PRO  — جاهز للتشغيل    ║
  ║   http://localhost:5000          ║
  ╚══════════════════════════════════╝
    """)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
