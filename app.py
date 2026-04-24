"""
╔══════════════════════════════════════════════════════════╗
║         DIALR PRO — أرخص dialer في الكون               ║
║   Stack: Python Flask + SQLite + WebRTC + multi-SIP     ║
║   Providers: Twilio · Voip.ms · Demo (no creds)         ║
╚══════════════════════════════════════════════════════════╝
"""
import os, json, time, csv, io, datetime
from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory, send_file, abort, Response,
)
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

import db
import providers as prv
import realtime as rt
from geo import COUNTRY_GEO

load_dotenv()
db.init()
prv.boot()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dialr-secret-2024")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ════════════════════════════════════════════════
# Utils
# ════════════════════════════════════════════════
def now_ms():
    return int(time.time() * 1000)

def now_s():
    return int(time.time())

def parse_phone(p):
    """Return (e164, country, carrier_type) using libphonenumber if available."""
    try:
        import phonenumbers
        from phonenumbers import geocoder, carrier, number_type, PhoneNumberType
        n = phonenumbers.parse(p, None) if p.startswith("+") else phonenumbers.parse(p, "US")
        if not phonenumbers.is_valid_number(n):
            return p, "", ""
        e164 = phonenumbers.format_number(n, phonenumbers.PhoneNumberFormat.E164)
        country_code = phonenumbers.region_code_for_number(n) or ""
        country_name = geocoder.description_for_number(n, "en") or country_code
        ntype = {
            PhoneNumberType.MOBILE: "mobile",
            PhoneNumberType.FIXED_LINE: "landline",
            PhoneNumberType.FIXED_LINE_OR_MOBILE: "mobile",
            PhoneNumberType.VOIP: "voip",
            PhoneNumberType.TOLL_FREE: "toll-free",
        }.get(number_type(n), "unknown")
        return e164, country_code, country_name, ntype
    except Exception:
        return p, "", "", "unknown"

def get_provider():
    pref = db.get_setting("active_provider", "auto")
    if pref == "auto":
        return prv.active()
    return prv.active(pref)

def base_url():
    return request.url_root.rstrip("/")


# ════════════════════════════════════════════════
# Static / index
# ════════════════════════════════════════════════
@app.route("/")
def index():
    p = get_provider()
    return render_template(
        "index.html",
        my_number=os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("VOIPMS_DID") or "+1 (000) 000-0000",
        active_provider=p.name,
    )

@app.route("/static/<path:f>")
def static_file(f):
    return send_from_directory("static", f)

@app.route("/uploads/<path:f>")
def uploads(f):
    return send_from_directory(UPLOAD_DIR, f)


# ════════════════════════════════════════════════
# Provider / system info
# ════════════════════════════════════════════════
@app.route("/api/system")
def api_system():
    return jsonify({
        "providers": prv.status(),
        "active": get_provider().name,
        "active_setting": db.get_setting("active_provider", "auto"),
        "my_number": os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("VOIPMS_DID") or "",
        "agent_name": db.get_setting("agent_name", "Agent"),
        "company_name": db.get_setting("company_name", "DIALR PRO"),
    })

@app.route("/api/system", methods=["POST"])
def api_system_set():
    data = request.get_json() or {}
    for k in ("active_provider", "agent_name", "company_name"):
        if k in data:
            db.set_setting(k, data[k])
    return jsonify({"ok": True})

@app.route("/token")
def get_token():
    p = prv.PROVIDERS.get("twilio")
    tok = p.get_token() if p else None
    if not tok:
        return jsonify({"token": None, "error": "Twilio WebRTC not configured"}), 200
    return jsonify({"token": tok})


# ════════════════════════════════════════════════
# Phone lookup
# ════════════════════════════════════════════════
@app.route("/api/lookup")
def api_lookup():
    phone = request.args.get("phone", "")
    res = parse_phone(phone)
    e164, cc, country, ntype = (res + ("",))[:4] if len(res) == 3 else res
    p = get_provider()
    return jsonify({
        "input": phone, "e164": e164,
        "country_code": cc, "country": country, "type": ntype,
        "estimated_cost_per_min": p.per_minute_cost(cc or "US"),
        "provider": p.name,
    })


# ════════════════════════════════════════════════
# Contacts
# ════════════════════════════════════════════════
@app.route("/api/contacts")
def api_contacts():
    q = request.args.get("q", "").strip()
    list_id = request.args.get("list_id")
    favorites = request.args.get("favorites") == "1"
    sql = """
        SELECT c.* FROM contacts c
        {join}
        WHERE 1=1 {where}
        ORDER BY c.favorite DESC, c.name COLLATE NOCASE
        LIMIT 1000
    """
    join = ""
    where = ""
    args = []
    if list_id:
        join = "JOIN contact_lists cl ON cl.contact_id = c.id"
        where += " AND cl.list_id = ?"
        args.append(list_id)
    if q:
        where += " AND (c.name LIKE ? OR c.phone LIKE ? OR c.company LIKE ? OR c.email LIKE ?)"
        like = f"%{q}%"
        args += [like, like, like, like]
    if favorites:
        where += " AND c.favorite = 1"
    with db.conn() as c:
        rows = c.execute(sql.format(join=join, where=where), args).fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/contacts", methods=["POST"])
def api_contacts_create():
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()
    if not phone:
        return jsonify({"error": "phone required"}), 400
    e164, cc, country, _ = parse_phone(phone) + ("",) if len(parse_phone(phone)) == 3 else parse_phone(phone)
    res = parse_phone(phone)
    if len(res) == 4:
        e164, cc, country, _ = res
    else:
        e164, cc, country = (res + ("",))[:3]
    with db.conn() as c:
        cur = c.execute(
            """INSERT INTO contacts(name, phone, email, company, country, tags, notes, favorite, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (data.get("name", ""), e164, data.get("email", ""), data.get("company", ""),
             country or "", data.get("tags", ""), data.get("notes", ""),
             1 if data.get("favorite") else 0, now_s()),
        )
        cid = cur.lastrowid
        for lid in data.get("list_ids", []) or []:
            c.execute("INSERT OR IGNORE INTO contact_lists(contact_id, list_id) VALUES (?,?)", (cid, lid))
    return jsonify({"id": cid})

@app.route("/api/contacts/<int:cid>", methods=["PATCH"])
def api_contacts_update(cid):
    data = request.get_json() or {}
    fields = ["name", "phone", "email", "company", "tags", "notes", "favorite"]
    sets, args = [], []
    for f in fields:
        if f in data:
            sets.append(f"{f}=?")
            args.append(data[f])
    if sets:
        args.append(cid)
        with db.conn() as c:
            c.execute(f"UPDATE contacts SET {', '.join(sets)} WHERE id=?", args)
    if "list_ids" in data:
        with db.conn() as c:
            c.execute("DELETE FROM contact_lists WHERE contact_id=?", (cid,))
            for lid in data["list_ids"]:
                c.execute("INSERT INTO contact_lists(contact_id, list_id) VALUES (?,?)", (cid, lid))
    return jsonify({"ok": True})

@app.route("/api/contacts/<int:cid>", methods=["DELETE"])
def api_contacts_delete(cid):
    with db.conn() as c:
        c.execute("DELETE FROM contacts WHERE id=?", (cid,))
    return jsonify({"ok": True})

@app.route("/api/contacts/<int:cid>/lists")
def api_contact_lists(cid):
    with db.conn() as c:
        rows = c.execute(
            "SELECT l.* FROM lists l JOIN contact_lists cl ON cl.list_id=l.id WHERE cl.contact_id=?",
            (cid,),
        ).fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/contacts/import", methods=["POST"])
def api_contacts_import():
    """Accepts CSV with columns: name, phone, email, company, tags, notes."""
    raw = request.data.decode("utf-8", errors="ignore") if request.data else ""
    if not raw and "file" in request.files:
        raw = request.files["file"].read().decode("utf-8", errors="ignore")
    if not raw:
        return jsonify({"error": "no csv data"}), 400
    reader = csv.DictReader(io.StringIO(raw))
    inserted = 0
    skipped = 0
    with db.conn() as c:
        for row in reader:
            phone = (row.get("phone") or row.get("Phone") or row.get("number") or "").strip()
            if not phone:
                skipped += 1
                continue
            res = parse_phone(phone)
            if len(res) == 4:
                e164, cc, country, _ = res
            else:
                e164, cc, country = (res + ("",))[:3]
            try:
                c.execute(
                    """INSERT INTO contacts(name, phone, email, company, country, tags, notes, created_at)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (row.get("name") or row.get("Name") or "",
                     e164,
                     row.get("email") or row.get("Email") or "",
                     row.get("company") or row.get("Company") or "",
                     country or "",
                     row.get("tags") or "",
                     row.get("notes") or "",
                     now_s()),
                )
                inserted += 1
            except Exception:
                skipped += 1
    return jsonify({"inserted": inserted, "skipped": skipped})

@app.route("/api/contacts/export")
def api_contacts_export():
    with db.conn() as c:
        rows = c.execute("SELECT name,phone,email,company,country,tags,notes FROM contacts ORDER BY name").fetchall()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["name", "phone", "email", "company", "country", "tags", "notes"])
    for r in rows:
        w.writerow([r["name"], r["phone"], r["email"], r["company"], r["country"], r["tags"], r["notes"]])
    return Response(
        out.getvalue(), mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


# ════════════════════════════════════════════════
# Lists
# ════════════════════════════════════════════════
@app.route("/api/lists")
def api_lists():
    with db.conn() as c:
        rows = c.execute("""
            SELECT l.*, (SELECT COUNT(*) FROM contact_lists cl WHERE cl.list_id=l.id) as count
            FROM lists l ORDER BY l.name COLLATE NOCASE
        """).fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/lists", methods=["POST"])
def api_lists_create():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "name required"}), 400
    with db.conn() as c:
        try:
            cur = c.execute(
                "INSERT INTO lists(name, color, description, created_at) VALUES (?,?,?,?)",
                (data["name"], data.get("color", "#00e5b0"), data.get("description", ""), now_s()),
            )
            return jsonify({"id": cur.lastrowid})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

@app.route("/api/lists/<int:lid>", methods=["PATCH"])
def api_lists_update(lid):
    data = request.get_json() or {}
    sets, args = [], []
    for f in ("name", "color", "description"):
        if f in data:
            sets.append(f"{f}=?")
            args.append(data[f])
    if sets:
        args.append(lid)
        with db.conn() as c:
            c.execute(f"UPDATE lists SET {', '.join(sets)} WHERE id=?", args)
    return jsonify({"ok": True})

@app.route("/api/lists/<int:lid>", methods=["DELETE"])
def api_lists_delete(lid):
    with db.conn() as c:
        c.execute("DELETE FROM lists WHERE id=?", (lid,))
    return jsonify({"ok": True})

@app.route("/api/lists/<int:lid>/contacts", methods=["POST"])
def api_lists_add_contacts(lid):
    """Add contacts to list. Body: {contact_ids: [...]}"""
    data = request.get_json() or {}
    ids = data.get("contact_ids", [])
    with db.conn() as c:
        for cid in ids:
            c.execute("INSERT OR IGNORE INTO contact_lists(contact_id, list_id) VALUES (?,?)", (cid, lid))
    return jsonify({"ok": True, "added": len(ids)})


# ════════════════════════════════════════════════
# Calls / dialing
# ════════════════════════════════════════════════
@app.route("/api/call", methods=["POST"])
def api_call():
    """Initiate an outbound call. Body: {to, contact_id?}"""
    data = request.get_json() or {}
    to = (data.get("to") or "").strip()
    if not to:
        return jsonify({"error": "to required"}), 400
    res = parse_phone(to)
    if len(res) == 4:
        e164, cc, country, _ = res
    else:
        e164, cc, country = (res + ("",))[:3]
    # DNC check
    with db.conn() as c:
        d = c.execute("SELECT 1 FROM dnc WHERE phone=?", (e164,)).fetchone()
        if d:
            return jsonify({"error": "Number is on DNC list"}), 400

    p = get_provider()
    try:
        result = p.place_call(
            to=e164,
            status_cb=f"{base_url()}/call/status",
            voice_cb=f"{base_url()}/voice",
        )
    except Exception as e:
        result = {"sid": f"err_{now_ms()}", "status": "failed", "error": str(e)}

    contact_id = data.get("contact_id")
    with db.conn() as c:
        cur = c.execute(
            """INSERT INTO calls(sid, direction, from_number, to_number, contact_id, status, started_at, provider)
               VALUES (?,?,?,?,?,?,?,?)""",
            (result.get("sid"), "outbound",
             os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("VOIPMS_DID") or "",
             e164, contact_id, result.get("status", "queued"), now_s(), p.name),
        )
        call_id = cur.lastrowid
        if contact_id:
            c.execute(
                "UPDATE contacts SET last_called_at=?, call_count=call_count+1 WHERE id=?",
                (now_s(), contact_id),
            )

    socketio.emit("call_started", {
        "id": call_id, "to": e164, "country": country,
        "provider": p.name, "status": result.get("status"),
    })
    return jsonify({
        "call_id": call_id,
        "sid": result.get("sid"),
        "status": result.get("status"),
        "provider": p.name,
        "estimated_cost_per_min": p.per_minute_cost(cc or "US"),
        "country": country,
    })

@app.route("/api/calls")
def api_calls():
    limit = int(request.args.get("limit", 100))
    contact_id = request.args.get("contact_id")
    disp = request.args.get("disposition_id")
    where = "WHERE 1=1"
    args = []
    if contact_id:
        where += " AND c.contact_id=?"
        args.append(contact_id)
    if disp:
        where += " AND c.disposition_id=?"
        args.append(disp)
    args.append(limit)
    with db.conn() as c:
        rows = c.execute(f"""
            SELECT c.*, ct.name AS contact_name, d.name AS disposition_name, d.color AS disposition_color
            FROM calls c
            LEFT JOIN contacts ct ON ct.id = c.contact_id
            LEFT JOIN dispositions d ON d.id = c.disposition_id
            {where}
            ORDER BY c.started_at DESC
            LIMIT ?
        """, args).fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/calls/<int:call_id>", methods=["PATCH"])
def api_calls_update(call_id):
    data = request.get_json() or {}
    sets, args = [], []
    for f in ("notes", "disposition_id", "transcript", "status", "duration", "ended_at"):
        if f in data:
            sets.append(f"{f}=?")
            args.append(data[f])
    if sets:
        args.append(call_id)
        with db.conn() as c:
            c.execute(f"UPDATE calls SET {', '.join(sets)} WHERE id=?", args)
    return jsonify({"ok": True})

@app.route("/api/calls/<int:call_id>", methods=["DELETE"])
def api_calls_delete(call_id):
    with db.conn() as c:
        c.execute("DELETE FROM calls WHERE id=?", (call_id,))
    return jsonify({"ok": True})

# Twilio TwiML voice webhook
@app.route("/voice", methods=["POST"])
def voice():
    try:
        from twilio.twiml.voice_response import VoiceResponse, Dial
    except Exception:
        return ("", 200, {"Content-Type": "text/xml"})
    to_number = request.form.get("To", "")
    response = VoiceResponse()
    if to_number and to_number.startswith("+"):
        dial = Dial(
            caller_id=os.getenv("TWILIO_PHONE_NUMBER", ""),
            record="record-from-answer",
            timeout=30,
        )
        dial.number(to_number)
        response.append(dial)
    else:
        response.say("Invalid number.", voice="alice")
    return str(response), 200, {"Content-Type": "text/xml"}

@app.route("/call/status", methods=["POST"])
def call_status():
    sid       = request.form.get("CallSid", "")
    status    = request.form.get("CallStatus", "")
    duration  = int(request.form.get("CallDuration", 0))
    rec_url   = request.form.get("RecordingUrl", "")
    p = get_provider()
    cost = round(duration / 60 * p.per_minute_cost("US"), 4) if duration else 0
    with db.conn() as c:
        c.execute("""
            UPDATE calls SET status=?, duration=?, cost=?, ended_at=?, recording_url=COALESCE(NULLIF(?, ''), recording_url)
            WHERE sid=?
        """, (status, duration, cost, now_s() if status == "completed" else None, rec_url, sid))
        row = c.execute("SELECT * FROM calls WHERE sid=?", (sid,)).fetchone()
    if row:
        socketio.emit("call_updated", db.row_to_dict(row))
    return "", 204


# ════════════════════════════════════════════════
# Dispositions
# ════════════════════════════════════════════════
@app.route("/api/dispositions")
def api_dispositions():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM dispositions ORDER BY sort_order, name").fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/dispositions", methods=["POST"])
def api_dispositions_create():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "name required"}), 400
    with db.conn() as c:
        try:
            cur = c.execute(
                "INSERT INTO dispositions(name, color, is_success, sort_order) VALUES (?,?,?,?)",
                (data["name"], data.get("color", "#64748b"),
                 1 if data.get("is_success") else 0, data.get("sort_order", 99)),
            )
            return jsonify({"id": cur.lastrowid})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

@app.route("/api/dispositions/<int:did>", methods=["DELETE"])
def api_dispositions_delete(did):
    with db.conn() as c:
        c.execute("DELETE FROM dispositions WHERE id=?", (did,))
    return jsonify({"ok": True})


# ════════════════════════════════════════════════
# SMS
# ════════════════════════════════════════════════
@app.route("/api/sms")
def api_sms_list():
    contact_id = request.args.get("contact_id")
    phone = request.args.get("phone")
    where, args = "WHERE 1=1", []
    if contact_id:
        where += " AND s.contact_id=?"; args.append(contact_id)
    if phone:
        where += " AND (s.to_number=? OR s.from_number=?)"; args += [phone, phone]
    args.append(200)
    with db.conn() as c:
        rows = c.execute(f"""
            SELECT s.*, ct.name AS contact_name FROM sms_messages s
            LEFT JOIN contacts ct ON ct.id = s.contact_id
            {where}
            ORDER BY s.sent_at DESC LIMIT ?
        """, args).fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/sms", methods=["POST"])
def api_sms_send():
    data = request.get_json() or {}
    to = (data.get("to") or "").strip()
    body = data.get("body", "")
    if not to or not body:
        return jsonify({"error": "to and body required"}), 400
    res = parse_phone(to)
    e164 = res[0]
    p = get_provider()
    try:
        out = p.send_sms(to=e164, body=body)
    except Exception as e:
        out = {"sid": f"err_{now_ms()}", "status": "failed", "error": str(e)}
    contact_id = data.get("contact_id")
    with db.conn() as c:
        cur = c.execute("""
            INSERT INTO sms_messages(sid, direction, from_number, to_number, body, status, sent_at, contact_id)
            VALUES (?,?,?,?,?,?,?,?)
        """, (out.get("sid"), "outbound",
              os.getenv("TWILIO_PHONE_NUMBER") or os.getenv("VOIPMS_DID") or "",
              e164, body, out.get("status", "sent"), now_s(), contact_id))
        smsid = cur.lastrowid
    socketio.emit("sms_sent", {"id": smsid, "to": e164, "body": body})
    return jsonify({"id": smsid, "status": out.get("status"), "provider": p.name})

@app.route("/sms/incoming", methods=["POST"])
def sms_incoming():
    """Twilio inbound SMS webhook."""
    body = request.form.get("Body", "")
    from_ = request.form.get("From", "")
    to = request.form.get("To", "")
    sid = request.form.get("MessageSid", "")
    with db.conn() as c:
        # match contact
        cm = c.execute("SELECT id FROM contacts WHERE phone=?", (from_,)).fetchone()
        cid = cm["id"] if cm else None
        cur = c.execute("""
            INSERT INTO sms_messages(sid, direction, from_number, to_number, body, status, sent_at, contact_id)
            VALUES (?,?,?,?,?,?,?,?)
        """, (sid, "inbound", from_, to, body, "received", now_s(), cid))
        smsid = cur.lastrowid
    socketio.emit("sms_received", {"id": smsid, "from": from_, "body": body, "contact_id": cid})
    return ("", 200, {"Content-Type": "text/xml"})


# ════════════════════════════════════════════════
# Scheduled callbacks
# ════════════════════════════════════════════════
@app.route("/api/scheduled")
def api_scheduled():
    with db.conn() as c:
        rows = c.execute("""
            SELECT s.*, ct.name AS contact_name FROM scheduled_calls s
            LEFT JOIN contacts ct ON ct.id = s.contact_id
            WHERE s.status='pending'
            ORDER BY s.scheduled_at ASC
        """).fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/scheduled", methods=["POST"])
def api_scheduled_create():
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()
    if not phone:
        return jsonify({"error": "phone required"}), 400
    when = int(data.get("scheduled_at", now_s()))
    with db.conn() as c:
        cur = c.execute("""
            INSERT INTO scheduled_calls(contact_id, phone, scheduled_at, note, status, created_at)
            VALUES (?,?,?,?, 'pending', ?)
        """, (data.get("contact_id"), phone, when, data.get("note", ""), now_s()))
        return jsonify({"id": cur.lastrowid})

@app.route("/api/scheduled/<int:sid>", methods=["DELETE"])
def api_scheduled_delete(sid):
    with db.conn() as c:
        c.execute("DELETE FROM scheduled_calls WHERE id=?", (sid,))
    return jsonify({"ok": True})

@app.route("/api/scheduled/<int:sid>/done", methods=["POST"])
def api_scheduled_done(sid):
    with db.conn() as c:
        c.execute("UPDATE scheduled_calls SET status='done' WHERE id=?", (sid,))
    return jsonify({"ok": True})


# ════════════════════════════════════════════════
# Scripts
# ════════════════════════════════════════════════
@app.route("/api/scripts")
def api_scripts():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM scripts ORDER BY category, title").fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/scripts", methods=["POST"])
def api_scripts_create():
    data = request.get_json() or {}
    if not data.get("title") or not data.get("body"):
        return jsonify({"error": "title and body required"}), 400
    with db.conn() as c:
        cur = c.execute(
            "INSERT INTO scripts(title, body, category, created_at) VALUES (?,?,?,?)",
            (data["title"], data["body"], data.get("category", "general"), now_s()),
        )
        return jsonify({"id": cur.lastrowid})

@app.route("/api/scripts/<int:sid>", methods=["PATCH"])
def api_scripts_update(sid):
    data = request.get_json() or {}
    sets, args = [], []
    for f in ("title", "body", "category"):
        if f in data:
            sets.append(f"{f}=?"); args.append(data[f])
    if sets:
        args.append(sid)
        with db.conn() as c:
            c.execute(f"UPDATE scripts SET {', '.join(sets)} WHERE id=?", args)
    return jsonify({"ok": True})

@app.route("/api/scripts/<int:sid>", methods=["DELETE"])
def api_scripts_delete(sid):
    with db.conn() as c:
        c.execute("DELETE FROM scripts WHERE id=?", (sid,))
    return jsonify({"ok": True})


# ════════════════════════════════════════════════
# Voicemail drop (audio uploads)
# ════════════════════════════════════════════════
@app.route("/api/voicemails")
def api_voicemails():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM voicemails ORDER BY created_at DESC").fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/voicemails", methods=["POST"])
def api_voicemails_create():
    name = request.form.get("name", "Voicemail")
    f = request.files.get("audio")
    if not f:
        return jsonify({"error": "audio file required"}), 400
    fname = f"vm_{now_ms()}_{f.filename or 'audio.webm'}"
    path = os.path.join(UPLOAD_DIR, fname)
    f.save(path)
    with db.conn() as c:
        cur = c.execute(
            "INSERT INTO voicemails(name, audio_path, created_at) VALUES (?,?,?)",
            (name, fname, now_s()),
        )
        return jsonify({"id": cur.lastrowid, "audio_path": fname})

@app.route("/api/voicemails/<int:vid>", methods=["DELETE"])
def api_voicemails_delete(vid):
    with db.conn() as c:
        row = c.execute("SELECT audio_path FROM voicemails WHERE id=?", (vid,)).fetchone()
        if row and row["audio_path"]:
            try:
                os.remove(os.path.join(UPLOAD_DIR, row["audio_path"]))
            except Exception:
                pass
        c.execute("DELETE FROM voicemails WHERE id=?", (vid,))
    return jsonify({"ok": True})


# ════════════════════════════════════════════════
# Do-Not-Call list
# ════════════════════════════════════════════════
@app.route("/api/dnc")
def api_dnc():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM dnc ORDER BY added_at DESC").fetchall()
    return jsonify(db.rows_to_list(rows))

@app.route("/api/dnc", methods=["POST"])
def api_dnc_create():
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()
    if not phone:
        return jsonify({"error": "phone required"}), 400
    res = parse_phone(phone)
    e164 = res[0]
    with db.conn() as c:
        try:
            c.execute("INSERT INTO dnc(phone, reason, added_at) VALUES (?,?,?)",
                      (e164, data.get("reason", ""), now_s()))
        except Exception:
            pass
    return jsonify({"ok": True})

@app.route("/api/dnc/<int:did>", methods=["DELETE"])
def api_dnc_delete(did):
    with db.conn() as c:
        c.execute("DELETE FROM dnc WHERE id=?", (did,))
    return jsonify({"ok": True})


# ════════════════════════════════════════════════
# Stats / Analytics
# ════════════════════════════════════════════════
@app.route("/api/stats")
def api_stats():
    with db.conn() as c:
        totals = c.execute("""
            SELECT COUNT(*) AS total_calls,
                   COALESCE(SUM(duration),0) AS total_seconds,
                   COALESCE(SUM(cost),0) AS total_cost,
                   COUNT(DISTINCT contact_id) AS unique_contacts
            FROM calls
        """).fetchone()
        today_start = int(time.time()) - (int(time.time()) % 86400)
        today = c.execute("""
            SELECT COUNT(*) AS calls_today,
                   COALESCE(SUM(duration),0) AS seconds_today,
                   COALESCE(SUM(cost),0) AS cost_today
            FROM calls WHERE started_at >= ?
        """, (today_start,)).fetchone()
        # 14-day timeseries
        series = c.execute("""
            SELECT DATE(started_at, 'unixepoch') AS day,
                   COUNT(*) AS calls,
                   COALESCE(SUM(duration),0) AS seconds,
                   COALESCE(SUM(cost),0) AS cost
            FROM calls
            WHERE started_at >= ?
            GROUP BY day ORDER BY day
        """, (now_s() - 14*86400,)).fetchall()
        # disposition breakdown
        disp = c.execute("""
            SELECT d.name, d.color, COUNT(c.id) AS count
            FROM dispositions d
            LEFT JOIN calls c ON c.disposition_id = d.id
            GROUP BY d.id ORDER BY count DESC
        """).fetchall()
        # top contacts
        top = c.execute("""
            SELECT ct.id, ct.name, ct.phone, COUNT(c.id) AS calls, COALESCE(SUM(c.duration),0) AS seconds
            FROM contacts ct
            JOIN calls c ON c.contact_id = ct.id
            GROUP BY ct.id ORDER BY calls DESC LIMIT 10
        """).fetchall()
        # contacts/lists/sms counts
        contacts_count = c.execute("SELECT COUNT(*) AS n FROM contacts").fetchone()["n"]
        lists_count    = c.execute("SELECT COUNT(*) AS n FROM lists").fetchone()["n"]
        sms_count      = c.execute("SELECT COUNT(*) AS n FROM sms_messages").fetchone()["n"]
        dnc_count      = c.execute("SELECT COUNT(*) AS n FROM dnc").fetchone()["n"]

    return jsonify({
        "total_calls": totals["total_calls"],
        "total_minutes": round(totals["total_seconds"]/60, 1),
        "total_cost": round(totals["total_cost"], 2),
        "unique_contacts": totals["unique_contacts"],
        "calls_today": today["calls_today"],
        "minutes_today": round(today["seconds_today"]/60, 1),
        "cost_today": round(today["cost_today"], 2),
        "series": db.rows_to_list(series),
        "dispositions": db.rows_to_list(disp),
        "top_contacts": db.rows_to_list(top),
        "contacts_count": contacts_count,
        "lists_count": lists_count,
        "sms_count": sms_count,
        "dnc_count": dnc_count,
    })


# ════════════════════════════════════════════════
# 🌍 World map / geo
# ════════════════════════════════════════════════
@app.route("/api/geo/countries")
def api_geo_countries():
    """Country code -> [lat, lng, capital]. Used by the 3D globe."""
    return jsonify({k: {"lat": v[0], "lng": v[1], "capital": v[2]}
                    for k, v in COUNTRY_GEO.items()})

@app.route("/api/geo/calls")
def api_geo_calls():
    """Recent calls with destination coordinates for the globe arcs."""
    with db.conn() as c:
        rows = c.execute("""
            SELECT c.to_number, c.duration, c.cost, c.started_at, c.provider,
                   ct.country AS contact_country, ct.name AS contact_name
            FROM calls c
            LEFT JOIN contacts ct ON ct.id = c.contact_id
            ORDER BY c.started_at DESC LIMIT 200
        """).fetchall()
    out = []
    for r in rows:
        res = parse_phone(r["to_number"] or "")
        cc = res[1] if len(res) >= 2 else ""
        geo = COUNTRY_GEO.get((cc or "").upper())
        if geo:
            out.append({
                "to": r["to_number"], "country_code": cc, "lat": geo[0], "lng": geo[1],
                "city": geo[2], "duration": r["duration"], "cost": r["cost"],
                "ts": r["started_at"], "provider": r["provider"],
                "name": r["contact_name"] or "",
            })
    return jsonify(out)


# ════════════════════════════════════════════════
# 💸 Cost optimizer — pick cheapest provider
# ════════════════════════════════════════════════
@app.route("/api/cost/route")
def api_cost_route():
    cc = request.args.get("country_code", "US")
    options = rt.optimize_route(cc, prv.PROVIDERS)
    return jsonify({"country_code": cc, "options": options,
                    "best": options[0] if options else None})


# ════════════════════════════════════════════════
# 🤖 AI Assistant
# ════════════════════════════════════════════════
@app.route("/api/ai/summarize", methods=["POST"])
def api_ai_summarize():
    data = request.get_json() or {}
    call_id = data.get("call_id")
    transcript, contact, duration = data.get("transcript", ""), data.get("contact", ""), int(data.get("duration", 0))
    if call_id and not transcript:
        with db.conn() as c:
            r = c.execute(
                "SELECT c.transcript, c.duration, ct.name FROM calls c "
                "LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=?",
                (call_id,)).fetchone()
            if r:
                transcript = r["transcript"] or ""
                duration = r["duration"] or 0
                contact = r["name"] or contact
    summary = rt.ai_summarize(transcript, contact, duration)
    if call_id:
        with db.conn() as c:
            c.execute("UPDATE calls SET notes = COALESCE(notes,'') || ? WHERE id=?",
                      (f"\n--- AI Summary ---\n{summary}\n", call_id))
    return jsonify({"summary": summary, "ai_enabled": rt._has_anthropic()})

@app.route("/api/ai/coach", methods=["POST"])
def api_ai_coach():
    data = request.get_json() or {}
    tips = rt.ai_coach(data.get("transcript", ""), data.get("contact", ""))
    return jsonify({"tips": tips, "ai_enabled": rt._has_anthropic()})

@app.route("/api/ai/status")
def api_ai_status():
    return jsonify({"anthropic": rt._has_anthropic(),
                    "model": os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")})


# ════════════════════════════════════════════════
# 🌐 DIALR Network (WebRTC P2P presence)
# ════════════════════════════════════════════════
@app.route("/api/network/users")
def api_network_users():
    return jsonify(rt.list_peers())


# ════════════════════════════════════════════════
# 📱 PWA — manifest & service worker
# ════════════════════════════════════════════════
@app.route("/manifest.json")
def manifest():
    return jsonify({
        "name": "DIALR PRO",
        "short_name": "DIALR",
        "description": "World's most legendary dialer — almost-free unlimited calls anywhere.",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#080b10",
        "theme_color": "#00e5b0",
        "orientation": "any",
        "icons": [
            {"src": "/static/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"},
        ],
    })

@app.route("/sw.js")
def service_worker():
    return Response(
        """const C='dialr-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll([
  '/','/static/styles.css','/static/app.js','/static/icon.svg'
]).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/socket.io/'))return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&u.origin===location.origin){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl));}
    return res;
  }).catch(()=>caches.match('/'))));
});""",
        mimetype="application/javascript",
    )


# ════════════════════════════════════════════════
# Socket events  (transcript + WebRTC P2P signaling)
# ════════════════════════════════════════════════
from flask import request as flask_request
from flask_socketio import join_room, leave_room

@socketio.on("connect")
def on_connect():
    emit("connected", {"ok": True, "ts": now_ms(), "sid": flask_request.sid})

@socketio.on("disconnect")
def on_disconnect():
    sid = flask_request.sid
    rt.unregister_peer(sid)
    socketio.emit("network_users", rt.list_peers())

@socketio.on("transcript")
def on_transcript(data):
    """Browser pushes live transcript chunks; we save & broadcast."""
    call_id = data.get("call_id")
    text = data.get("text", "")
    if call_id and text:
        with db.conn() as c:
            c.execute(
                "UPDATE calls SET transcript = COALESCE(transcript,'') || ? WHERE id=?",
                (text + "\n", call_id),
            )
    emit("transcript_update", data, broadcast=True)

# ── WebRTC P2P signaling ────────────────────────────────
@socketio.on("p2p_register")
def p2p_register(data):
    sid = flask_request.sid
    handle = (data or {}).get("handle", "").strip() or sid[:6]
    country = (data or {}).get("country", "")
    rt.register_peer(sid, handle, country)
    emit("p2p_registered", {"sid": sid, "handle": handle})
    socketio.emit("network_users", rt.list_peers())

@socketio.on("p2p_offer")
def p2p_offer(data):
    """Caller -> Callee: SDP offer. data = {to, from_handle, sdp, call_type}"""
    target = (data or {}).get("to")
    if target:
        socketio.emit("p2p_offer", {
            "from": flask_request.sid,
            "from_handle": (data or {}).get("from_handle", ""),
            "sdp": data.get("sdp"),
            "call_type": data.get("call_type", "audio"),
        }, room=target)

@socketio.on("p2p_answer")
def p2p_answer(data):
    target = (data or {}).get("to")
    if target:
        socketio.emit("p2p_answer", {
            "from": flask_request.sid,
            "sdp": data.get("sdp"),
        }, room=target)

@socketio.on("p2p_ice")
def p2p_ice(data):
    target = (data or {}).get("to")
    if target:
        socketio.emit("p2p_ice", {
            "from": flask_request.sid,
            "candidate": data.get("candidate"),
        }, room=target)

@socketio.on("p2p_hangup")
def p2p_hangup(data):
    target = (data or {}).get("to")
    if target:
        socketio.emit("p2p_hangup", {"from": flask_request.sid}, room=target)
    rt.set_in_call(flask_request.sid, False)

@socketio.on("p2p_reject")
def p2p_reject(data):
    target = (data or {}).get("to")
    if target:
        socketio.emit("p2p_reject", {"from": flask_request.sid}, room=target)


# ════════════════════════════════════════════════
if __name__ == "__main__":
    print("""
  ╔══════════════════════════════════════════╗
  ║   DIALR PRO  — http://0.0.0.0:5000        ║
  ╚══════════════════════════════════════════╝
    """)
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)
