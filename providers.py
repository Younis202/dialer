"""Provider abstraction: Twilio, Voip.ms, Demo (no-network).

Each provider exposes:
  - configured() -> bool
  - place_call(to, from_, status_cb_url, voice_cb_url) -> dict
  - send_sms(to, from_, body) -> dict
  - get_token(identity) -> str | None      (only Twilio supports browser WebRTC token)
  - per_minute_cost(country_code='US') -> float
"""
import os, json, base64, time, urllib.request, urllib.parse


def _safe_import_twilio():
    try:
        from twilio.rest import Client
        from twilio.jwt.access_token import AccessToken
        from twilio.jwt.access_token.grants import VoiceGrant
        return Client, AccessToken, VoiceGrant
    except Exception:
        return None, None, None


# ── TWILIO ──────────────────────────────────────────────
class TwilioProvider:
    name = "twilio"

    def __init__(self):
        self.sid       = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.token     = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.number    = os.getenv("TWILIO_PHONE_NUMBER", "")
        self.api_key   = os.getenv("TWILIO_API_KEY", "")
        self.api_sec   = os.getenv("TWILIO_API_SECRET", "")
        self.app_sid   = os.getenv("TWILIO_TWIML_APP_SID", "")
        Client, _, _ = _safe_import_twilio()
        self._client = Client(self.sid, self.token) if (Client and self.sid and self.token) else None

    def configured(self):
        return bool(self.sid and self.token and self.number)

    def webrtc_ready(self):
        return self.configured() and bool(self.api_key and self.api_sec and self.app_sid)

    def get_token(self, identity="dialr_user"):
        _, AccessToken, VoiceGrant = _safe_import_twilio()
        if not self.webrtc_ready() or not AccessToken:
            return None
        tok = AccessToken(self.sid, self.api_key, self.api_sec, identity=identity, ttl=3600)
        tok.add_grant(VoiceGrant(outgoing_application_sid=self.app_sid, incoming_allow=True))
        return tok.to_jwt()

    def place_call(self, to, from_=None, status_cb=None, voice_cb=None):
        if not self._client:
            raise RuntimeError("Twilio not configured")
        call = self._client.calls.create(
            to=to,
            from_=from_ or self.number,
            url=voice_cb,
            status_callback=status_cb,
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            status_callback_method="POST",
            record=True,
        )
        return {"sid": call.sid, "status": call.status}

    def send_sms(self, to, body, from_=None):
        if not self._client:
            raise RuntimeError("Twilio not configured")
        msg = self._client.messages.create(to=to, from_=from_ or self.number, body=body)
        return {"sid": msg.sid, "status": msg.status}

    def per_minute_cost(self, country_code="US"):
        # rough estimates ($/min)
        base = {"US": 0.014, "CA": 0.014, "GB": 0.018, "EG": 0.180,
                "DE": 0.020, "FR": 0.020, "AE": 0.110, "SA": 0.140}
        return base.get(country_code.upper(), 0.05)


# ── VOIP.MS (REST API) ──────────────────────────────────
class VoipMsProvider:
    name = "voipms"
    BASE = "https://voip.ms/api/v1/rest.php"

    def __init__(self):
        self.user = os.getenv("VOIPMS_USERNAME", "")
        self.pwd  = os.getenv("VOIPMS_PASSWORD", "")
        self.did  = os.getenv("VOIPMS_DID", "")

    def configured(self):
        return bool(self.user and self.pwd and self.did)

    def webrtc_ready(self):
        return False  # browser SIP would need sip.js; not auto-configured

    def get_token(self, identity="dialr_user"):
        return None

    def _call(self, method, **params):
        params.update({
            "api_username": self.user,
            "api_password": self.pwd,
            "method": method,
            "content_type": "json",
        })
        url = self.BASE + "?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=15) as r:
            return json.loads(r.read().decode("utf-8"))

    def place_call(self, to, from_=None, status_cb=None, voice_cb=None):
        # voip.ms `callBack` triggers an outbound call to the DID and bridges to destination
        res = self._call(
            "callBack",
            destination=to.lstrip("+"),
            callerid=(from_ or self.did),
        )
        return {"sid": res.get("callback") or "", "status": res.get("status", "queued")}

    def send_sms(self, to, body, from_=None):
        res = self._call("sendSMS", did=self.did, dst=to.lstrip("+"), message=body[:160])
        return {"sid": res.get("sms") or "", "status": res.get("status", "sent")}

    def per_minute_cost(self, country_code="US"):
        # voip.ms rates are roughly half of twilio for many countries
        base = {"US": 0.0085, "CA": 0.0085, "GB": 0.012, "EG": 0.110,
                "DE": 0.014, "FR": 0.014, "AE": 0.080, "SA": 0.110}
        return base.get(country_code.upper(), 0.030)


# ── DEMO (works without any creds) ──────────────────────
class DemoProvider:
    name = "demo"

    def configured(self):
        return True

    def webrtc_ready(self):
        return False

    def get_token(self, identity="dialr_user"):
        return None

    def place_call(self, to, from_=None, status_cb=None, voice_cb=None):
        return {"sid": f"demo_{int(time.time()*1000)}", "status": "queued"}

    def send_sms(self, to, body, from_=None):
        return {"sid": f"demo_sms_{int(time.time()*1000)}", "status": "sent"}

    def per_minute_cost(self, country_code="US"):
        return 0.0


# ── REGISTRY ────────────────────────────────────────────
PROVIDERS = {}

def boot():
    PROVIDERS["twilio"] = TwilioProvider()
    PROVIDERS["voipms"] = VoipMsProvider()
    PROVIDERS["demo"]   = DemoProvider()

def active(preferred=None):
    """Return active provider. Falls back gracefully."""
    if preferred and preferred in PROVIDERS and PROVIDERS[preferred].configured():
        return PROVIDERS[preferred]
    for name in ("twilio", "voipms"):
        if name in PROVIDERS and PROVIDERS[name].configured():
            return PROVIDERS[name]
    return PROVIDERS["demo"]

def status():
    return {
        name: {
            "configured": p.configured(),
            "webrtc_ready": getattr(p, "webrtc_ready", lambda: False)(),
        }
        for name, p in PROVIDERS.items()
    }
