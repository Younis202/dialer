"""SQLite layer for DIALR PRO."""
import sqlite3, os, json, time
from contextlib import contextmanager

DB_PATH = os.getenv("DIALR_DB", "dialr.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    company TEXT DEFAULT '',
    country TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    favorite INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_called_at INTEGER,
    call_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS ix_contacts_name ON contacts(name);

CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#00e5b0',
    description TEXT DEFAULT '',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_lists (
    contact_id INTEGER NOT NULL,
    list_id INTEGER NOT NULL,
    PRIMARY KEY (contact_id, list_id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sid TEXT,
    direction TEXT DEFAULT 'outbound',
    from_number TEXT,
    to_number TEXT,
    contact_id INTEGER,
    status TEXT,
    duration INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    recording_url TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    disposition_id INTEGER,
    notes TEXT DEFAULT '',
    transcript TEXT DEFAULT '',
    provider TEXT DEFAULT 'demo',
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    FOREIGN KEY (disposition_id) REFERENCES dispositions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_calls_started ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS ix_calls_contact ON calls(contact_id);

CREATE TABLE IF NOT EXISTS dispositions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#64748b',
    is_success INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sms_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sid TEXT,
    direction TEXT,
    from_number TEXT,
    to_number TEXT,
    body TEXT,
    status TEXT DEFAULT 'sent',
    sent_at INTEGER NOT NULL,
    contact_id INTEGER,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_sms_sent ON sms_messages(sent_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    phone TEXT NOT NULL,
    scheduled_at INTEGER NOT NULL,
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS voicemails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    audio_path TEXT,
    duration INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dnc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    reason TEXT DEFAULT '',
    added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS power_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    total INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL
);
"""

DEFAULT_DISPOSITIONS = [
    ("Connected",      "#00e5b0", 1, 1),
    ("Voicemail",      "#3b82f6", 0, 2),
    ("No Answer",      "#64748b", 0, 3),
    ("Busy",           "#fbbf24", 0, 4),
    ("Wrong Number",   "#ff4757", 0, 5),
    ("Callback Later", "#a78bfa", 0, 6),
    ("Not Interested", "#ff8a4d", 0, 7),
    ("Sale",           "#22c55e", 1, 8),
    ("DNC",            "#ef4444", 0, 9),
]

DEFAULT_SCRIPTS = [
    ("Cold Open", "Hi, this is {agent} calling from {company}. Do you have a quick minute?", "intro"),
    ("Voicemail", "Hi, this is {agent}. I'll try you again later. You can reach me at {callback}.", "voicemail"),
    ("Discovery", "What's the biggest challenge you're facing with {topic} right now?", "discovery"),
    ("Close",     "Based on what you shared, the next step would be {action}. Sound good?", "close"),
]

@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()

def init():
    with conn() as c:
        c.executescript(SCHEMA)
        # seed dispositions if empty
        cur = c.execute("SELECT COUNT(*) FROM dispositions")
        if cur.fetchone()[0] == 0:
            for name, color, is_success, sort_order in DEFAULT_DISPOSITIONS:
                c.execute(
                    "INSERT INTO dispositions(name, color, is_success, sort_order) VALUES (?,?,?,?)",
                    (name, color, is_success, sort_order),
                )
        cur = c.execute("SELECT COUNT(*) FROM scripts")
        if cur.fetchone()[0] == 0:
            now = int(time.time())
            for title, body, cat in DEFAULT_SCRIPTS:
                c.execute(
                    "INSERT INTO scripts(title, body, category, created_at) VALUES (?,?,?,?)",
                    (title, body, cat, now),
                )

def row_to_dict(row):
    return dict(row) if row else None

def rows_to_list(rows):
    return [dict(r) for r in rows]

# ── Settings helpers ──
def get_setting(key, default=None):
    with conn() as c:
        r = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        if not r:
            return default
        try:
            return json.loads(r["value"])
        except Exception:
            return r["value"]

def set_setting(key, value):
    with conn() as c:
        c.execute(
            "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value)),
        )
