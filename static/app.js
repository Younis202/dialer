/* DIALR PRO — main client */
(() => {
"use strict";

// ── Tiny helpers ─────────────────────────────────────────
const $  = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));
const h  = (tag, attrs={}, ...kids) => {
  const el = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") el.className = attrs[k];
    else if (k === "style") el.style.cssText = attrs[k];
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), attrs[k]);
    else if (k === "html") el.innerHTML = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
};
const fmtDur = (s) => {
  s = +s || 0;
  const m = Math.floor(s/60), sec = s % 60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
};
const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts*1000);
  return d.toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
};
const fmtDate = (ts) => ts ? new Date(ts*1000).toLocaleDateString() : "—";
const initials = (name="") => (name.trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2) || "?").toUpperCase();
const escapeHtml = (s) => String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body||{}) });
    return r.json();
  },
  async patch(url, body) {
    const r = await fetch(url, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body||{}) });
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method:"DELETE" });
    return r.json();
  },
  async upload(url, formData) {
    const r = await fetch(url, { method:"POST", body: formData });
    return r.json();
  },
};

// ── Toasts ──────────────────────────────────────────────
function toast(msg, type="ok") {
  const root = $("#toasts");
  const t = h("div", { class: `toast ${type==="error"?"error":type==="warn"?"warn":""}` }, msg);
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2400);
  setTimeout(() => t.remove(), 2800);
}

// ── State ───────────────────────────────────────────────
const state = {
  system: null,
  contacts: [],
  lists: [],
  calls: [],
  dispositions: [],
  scripts: [],
  scheduled: [],
  voicemails: [],
  dnc: [],
  sms: [],
  smsThreads: {},
  activeThread: null,
  activeCall: null,
  callTimer: null,
  callElapsed: 0,
  power: { running:false, queue:[], idx:0, listId:null, sessionStart:null, autoNext:true },
  speech: null,
  speechActive: false,
  charts: { calls:null, disp:null },
};

// ── Modal ───────────────────────────────────────────────
function modal({ title, body, footer, large=false }) {
  const back = $("#modal-back");
  const wrap = $("#modal-content");
  wrap.classList.toggle("lg", large);
  wrap.innerHTML = "";
  wrap.appendChild(h("div", { class:"modal-head" },
    h("div", { class:"modal-title" }, title),
    h("button", { class:"modal-close", onclick: () => back.classList.remove("show") }, "×"),
  ));
  const bodyEl = h("div", { class:"modal-body" });
  if (typeof body === "string") bodyEl.innerHTML = body;
  else if (Array.isArray(body)) body.forEach(b => bodyEl.appendChild(b));
  else if (body) bodyEl.appendChild(body);
  wrap.appendChild(bodyEl);
  if (footer) wrap.appendChild(h("div", { class:"modal-foot" }, ...footer));
  back.classList.add("show");
}
function closeModal() { $("#modal-back").classList.remove("show"); }

// ── Routing / Navigation ────────────────────────────────
function navigate(page) {
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === page));
  $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
  const titles = {
    dialer: ["Dialer", "Make calls anywhere in the world"],
    power:  ["Power Dialer", "Auto-dial through any list"],
    contacts: ["Contacts", "Manage everyone you call"],
    lists:    ["Lists", "Group contacts by campaign"],
    history:  ["Call History", "Every call, recorded & taggable"],
    sms:      ["SMS", "Two-way messaging"],
    scheduled: ["Scheduled", "Callbacks & reminders"],
    scripts:  ["Scripts", "On-call talk tracks"],
    voicemail: ["Voicemail Drop", "Pre-recorded messages"],
    analytics: ["Analytics", "Performance & cost tracking"],
    dnc:      ["Do Not Call", "Blocked numbers"],
    settings: ["Settings", "Providers, dispositions, agent info"],
  };
  const [t, sub] = titles[page] || ["", ""];
  $("#page-title").textContent = t;
  $("#page-sub").textContent = sub;
  // refresh per-page data
  if (page === "history") loadCalls();
  if (page === "contacts") renderContacts();
  if (page === "lists") renderLists();
  if (page === "sms") renderSmsThreads();
  if (page === "scheduled") loadScheduled();
  if (page === "scripts") loadScripts();
  if (page === "voicemail") loadVoicemails();
  if (page === "dnc") loadDnc();
  if (page === "settings") renderSettings();
  if (page === "analytics") loadAnalytics();
  if (page === "power") renderPower();
}

// ── System / Provider ───────────────────────────────────
async function loadSystem() {
  state.system = await api.get("/api/system");
  const pill = $("#provider-pill");
  pill.className = "provider-pill " + (state.system.active === "demo" ? "demo" : "live");
  $("#provider-name").textContent = state.system.active.toUpperCase();
  $("#my-number").textContent = state.system.my_number || "—";
}

// ── Dialer ──────────────────────────────────────────────
const dialer = {
  el: null, input: null, lookupTimer: null, currentCallId: null, currentSid: null,
  init() {
    this.input = $("#number-input");
    this.input.addEventListener("input", () => this.onChange());
    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter") this.call();
    });
    $$(".key").forEach(k => k.addEventListener("click", () => this.press(k.dataset.k)));
    $("#del-btn").addEventListener("click", () => {
      this.input.value = this.input.value.slice(0, -1);
      this.onChange();
    });
    $("#del-btn").addEventListener("contextmenu", e => { e.preventDefault(); this.input.value=""; this.onChange(); });
    $("#call-btn").addEventListener("click", () => this.call());
    $("#add-contact-from-dial").addEventListener("click", () => {
      if (!this.input.value) return toast("Enter a number first", "warn");
      openContactModal({ phone: this.input.value });
    });
    $("#sms-from-dial").addEventListener("click", () => {
      if (!this.input.value) return toast("Enter a number first", "warn");
      navigate("sms");
      $("#sms-to-input").value = this.input.value;
      $("#sms-body-input").focus();
    });
  },
  press(k) {
    if (this.currentCallId) {
      // send DTMF visually + tone
      playDtmf(k);
    }
    this.input.value += k;
    this.onChange();
  },
  onChange() {
    clearTimeout(this.lookupTimer);
    const v = this.input.value.trim();
    if (!v) { $("#lookup-info").textContent = "Type or paste a number — international format like +1..."; return; }
    this.lookupTimer = setTimeout(async () => {
      try {
        const info = await api.get(`/api/lookup?phone=${encodeURIComponent(v)}`);
        const cost = info.estimated_cost_per_min;
        $("#lookup-info").innerHTML = info.country
          ? `<span class="cc">${info.country_code}</span> · ${escapeHtml(info.country)} · ${info.type} · est. <b>$${cost.toFixed(4)}/min</b> via ${info.provider}`
          : `Could not parse · default est. $${cost.toFixed(4)}/min via ${info.provider}`;
      } catch(e) {}
    }, 350);
  },
  async call() {
    const to = this.input.value.trim();
    if (!to) return toast("Enter a number", "warn");
    if (this.currentCallId) return this.hangup();
    try {
      const res = await api.post("/api/call", { to });
      if (res.error) throw new Error(res.error);
      this.currentCallId = res.call_id;
      this.currentSid = res.sid;
      startActiveCall({ to, country: res.country, provider: res.provider, callId: res.call_id });
    } catch(e) {
      toast("Call failed: " + e.message, "error");
    }
  },
  hangup() {
    endActiveCall();
    this.currentCallId = null;
    this.currentSid = null;
  },
};

// ── Active call panel ───────────────────────────────────
function startActiveCall({ to, country, provider, callId, name }) {
  state.activeCall = { to, country, provider, callId, name: name||"" };
  state.callElapsed = 0;
  $("#active-bar").classList.add("show");
  $("#active-name").textContent = name ? `${name} · ${to}` : to;
  $("#active-meta").textContent = `${country || ""} · ${provider.toUpperCase()} · 00:00`;
  $("#call-btn").classList.add("calling");
  $("#call-btn-icon").innerHTML = `<path d="M3 3l18 18M16.5 16.5C13.5 19 9 19 6 17l-2-1 1-3a8 8 0 015-5l3-1 1 2c2 3 2 7-.5 9.5z"/>`;
  state.callTimer = setInterval(() => {
    state.callElapsed += 1;
    $("#active-meta").textContent = `${country || ""} · ${provider.toUpperCase()} · ${fmtDur(state.callElapsed)}`;
  }, 1000);
  // open call panel
  showCallPanel();
  // start transcription if available
  if (state.speechActive) startSpeech();
}

function endActiveCall() {
  const callId = state.activeCall?.callId;
  const dur = state.callElapsed;
  $("#active-bar").classList.remove("show");
  $("#call-btn").classList.remove("calling");
  $("#call-btn-icon").innerHTML = `<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>`;
  clearInterval(state.callTimer);
  if (callId && dur > 0) {
    api.patch(`/api/calls/${callId}`, {
      duration: dur, status: "completed", ended_at: Math.floor(Date.now()/1000),
    });
  }
  hideCallPanel();
  stopSpeech();
  state.activeCall = null;
  loadRightPaneData();
}

function showCallPanel() {
  const p = $("#call-panel");
  p.classList.remove("hidden");
  $("#cp-name").textContent = state.activeCall?.name || state.activeCall?.to || "—";
  $("#cp-phone").textContent = state.activeCall?.to || "";
  $("#cp-notes").value = "";
  $("#cp-disposition").innerHTML = state.dispositions.map(d =>
    `<button class="disposition-btn" data-id="${d.id}" style="border-color:${d.color}33;color:${d.color}">${escapeHtml(d.name)}</button>`
  ).join("");
  $$("#cp-disposition .disposition-btn").forEach(b => b.addEventListener("click", () => {
    api.patch(`/api/calls/${state.activeCall.callId}`, { disposition_id: +b.dataset.id });
    toast("Disposition saved");
    if (state.power.running && state.power.autoNext) {
      setTimeout(() => endActiveCall(), 200);
      setTimeout(() => powerNext(), 600);
    }
  }));
  $("#cp-script").innerHTML = state.scripts.map(s =>
    `<div class="script-card" style="margin-bottom:8px"><div class="head"><div class="title">${escapeHtml(s.title)}</div><div class="cat">${escapeHtml(s.category)}</div></div><div class="body">${escapeHtml(s.body)}</div></div>`
  ).join("") || `<div class="text-muted text-xs">No scripts. Add some in the Scripts tab.</div>`;
  $("#transcript-box").innerHTML = "";
}
function hideCallPanel() {
  // save notes
  const notes = $("#cp-notes").value;
  if (state.activeCall?.callId && notes) {
    api.patch(`/api/calls/${state.activeCall.callId}`, { notes });
  }
  $("#call-panel").classList.add("hidden");
}

// ── DTMF tones (browser-side) ───────────────────────────
let audioCtx = null;
function playDtmf(k) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const map = { "1":[697,1209], "2":[697,1336], "3":[697,1477],
                  "4":[770,1209], "5":[770,1336], "6":[770,1477],
                  "7":[852,1209], "8":[852,1336], "9":[852,1477],
                  "*":[941,1209], "0":[941,1336], "#":[941,1477] };
    const f = map[k]; if (!f) return;
    const g = audioCtx.createGain(); g.gain.value = 0.08; g.connect(audioCtx.destination);
    [f[0], f[1]].forEach(freq => {
      const o = audioCtx.createOscillator(); o.type="sine"; o.frequency.value=freq;
      o.connect(g); o.start(); o.stop(audioCtx.currentTime + 0.13);
    });
  } catch(e) {}
}

// ── Speech recognition (live transcription) ─────────────
function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  state.speechActive = true;
  state.speech = new SR();
  state.speech.continuous = true;
  state.speech.interimResults = true;
  state.speech.lang = navigator.language || "en-US";
  state.speech.onresult = (e) => {
    let final = "", interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t + " "; else interim += t;
    }
    const box = $("#transcript-box");
    if (!box) return;
    if (final) {
      box.innerHTML += escapeHtml(final) + " ";
      box.scrollTop = box.scrollHeight;
      if (state.activeCall?.callId && socket) {
        socket.emit("transcript", { call_id: state.activeCall.callId, text: final });
      }
    }
    box.innerHTML = box.innerHTML.replace(/<span class="live">.*?<\/span>$/, "");
    if (interim) box.innerHTML += `<span class="live">${escapeHtml(interim)}</span>`;
  };
  state.speech.onerror = () => {};
  state.speech.onend = () => { if (state.activeCall) try { state.speech.start(); } catch(e){} };
}
function startSpeech() { if (state.speech) try { state.speech.start(); } catch(e){} }
function stopSpeech() { if (state.speech) try { state.speech.stop(); } catch(e){} }

// ── Right pane (recent calls + quick stats) ─────────────
async function loadRightPaneData() {
  const stats = await api.get("/api/stats");
  $("#stat-today-calls").textContent = stats.calls_today;
  $("#stat-today-min").textContent = stats.minutes_today;
  $("#stat-today-cost").textContent = "$" + stats.cost_today.toFixed(2);
  $("#stat-total-contacts").textContent = stats.contacts_count;

  const calls = await api.get("/api/calls?limit=8");
  const list = $("#recent-calls-mini");
  list.innerHTML = "";
  if (!calls.length) {
    list.innerHTML = `<div class="text-muted text-xs">No calls yet.</div>`;
  } else {
    calls.forEach(c => {
      const item = h("div", { class:"mini-item", onclick: () => {
        $("#number-input").value = c.to_number;
        dialer.onChange();
        navigate("dialer");
      } },
        h("div", { class:"mini-avatar" }, initials(c.contact_name || c.to_number)),
        h("div", { class:"mini-content" },
          h("div", { class:"mini-name" }, c.contact_name || c.to_number),
          h("div", { class:"mini-meta" }, fmtTime(c.started_at) + " · " + fmtDur(c.duration||0)),
        ),
        h("div", { class:"mini-icon out", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17l10-10M17 7H8M17 7v9"/></svg>` }),
      );
      list.appendChild(item);
    });
  }
  // sidebar counts
  $("#nav-count-contacts").textContent = stats.contacts_count;
  $("#nav-count-history").textContent = stats.total_calls;
  $("#nav-count-sms").textContent = stats.sms_count;
  $("#nav-count-dnc").textContent = stats.dnc_count;
}

// ── Contacts page ───────────────────────────────────────
async function loadContacts() {
  state.contacts = await api.get("/api/contacts");
}
async function loadLists() {
  state.lists = await api.get("/api/lists");
}
function renderContacts(filter="") {
  const tbody = $("#contacts-tbody");
  let rows = state.contacts;
  if (filter) {
    const q = filter.toLowerCase();
    rows = rows.filter(c =>
      (c.name||"").toLowerCase().includes(q) ||
      (c.phone||"").toLowerCase().includes(q) ||
      (c.company||"").toLowerCase().includes(q) ||
      (c.email||"").toLowerCase().includes(q));
  }
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="em-icon">⚆</div>No contacts yet. Click <b>+ New</b> or import a CSV.</div></td></tr>`;
    return;
  }
  rows.forEach(c => {
    const tr = h("tr", { class:"contact-row" },
      h("td", {},
        h("div", { class:"row" },
          h("div", { class:"mini-avatar", style:"width:28px;height:28px;font-size:10px" }, initials(c.name||c.phone)),
          h("div", {},
            h("div", { style:"font-weight:600" }, c.name || "(no name)"),
            h("div", { class:"text-xs text-muted text-mono" }, c.email || ""),
          ),
        ),
      ),
      h("td", { class:"cell-mono" }, c.phone),
      h("td", {}, c.company || h("span", { class:"text-muted" }, "—")),
      h("td", { html: (c.tags||"").split(",").filter(Boolean).map(t => `<span class="tag-pill">${escapeHtml(t.trim())}</span>`).join("") || `<span class="text-muted">—</span>` }),
      h("td", { class:"cell-mono cell-muted" }, c.country || "—"),
      h("td", { class:"actions" },
        iconBtn("phone", () => quickCall(c.phone, c.id, c.name)),
        iconBtn("msg",   () => { navigate("sms"); $("#sms-to-input").value = c.phone; }),
        iconBtn("edit",  () => openContactModal(c)),
        iconBtn("trash", async () => {
          if (!confirm(`Delete ${c.name || c.phone}?`)) return;
          await api.del(`/api/contacts/${c.id}`);
          await loadContacts(); renderContacts($("#contacts-search").value);
          loadRightPaneData();
        }, "danger"),
      ),
    );
    tbody.appendChild(tr);
  });
}

function iconBtn(kind, onClick, cls="") {
  const icons = {
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`,
    msg:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    edit:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>`,
    play:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    note:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    cal:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  };
  return h("button", { class:"icon-btn " + cls, onclick: onClick, html: icons[kind] || "" });
}

function openContactModal(c={}) {
  const isNew = !c.id;
  const f = {
    name:    h("input", { class:"input", value: c.name || "" }),
    phone:   h("input", { class:"input input-mono", value: c.phone || "" }),
    email:   h("input", { class:"input", value: c.email || "" }),
    company: h("input", { class:"input", value: c.company || "" }),
    tags:    h("input", { class:"input", value: c.tags || "", placeholder:"comma,separated" }),
    notes:   h("textarea", { class:"textarea" }, c.notes || ""),
  };
  modal({
    title: isNew ? "New Contact" : "Edit Contact",
    body: [
      h("div", { class:"field" }, h("label", {}, "Name"), f.name),
      h("div", { class:"field" }, h("label", {}, "Phone (E.164)"), f.phone),
      h("div", { class:"field" }, h("label", {}, "Email"), f.email),
      h("div", { class:"field" }, h("label", {}, "Company"), f.company),
      h("div", { class:"field" }, h("label", {}, "Tags"), f.tags),
      h("div", { class:"field" }, h("label", {}, "Notes"), f.notes),
    ],
    footer: [
      h("button", { class:"btn", onclick: closeModal }, "Cancel"),
      h("button", { class:"btn primary", onclick: async () => {
        const body = {
          name: f.name.value, phone: f.phone.value, email: f.email.value,
          company: f.company.value, tags: f.tags.value, notes: f.notes.value,
        };
        if (isNew) await api.post("/api/contacts", body);
        else await api.patch(`/api/contacts/${c.id}`, body);
        closeModal();
        await loadContacts(); renderContacts($("#contacts-search").value);
        loadRightPaneData();
        toast(isNew ? "Contact added" : "Contact updated");
      } }, isNew ? "Create" : "Save"),
    ],
  });
}

async function quickCall(phone, contactId, name) {
  $("#number-input").value = phone;
  dialer.onChange();
  try {
    const res = await api.post("/api/call", { to: phone, contact_id: contactId });
    if (res.error) throw new Error(res.error);
    dialer.currentCallId = res.call_id;
    dialer.currentSid = res.sid;
    startActiveCall({ to: res.country ? phone : phone, country: res.country, provider: res.provider, callId: res.call_id, name });
    navigate("dialer");
  } catch(e) {
    toast("Call failed: " + e.message, "error");
  }
}

// ── Lists page ──────────────────────────────────────────
function renderLists() {
  const wrap = $("#lists-wrap");
  wrap.innerHTML = "";
  if (!state.lists.length) {
    wrap.innerHTML = `<div class="empty"><div class="em-icon">≡</div>No lists. Create one to start grouping contacts.</div>`;
    return;
  }
  state.lists.forEach(l => {
    const card = h("div", { class:"chart-card", style:"display:flex;justify-content:space-between;align-items:center" },
      h("div", {},
        h("div", { style:`font-weight:700;color:${l.color}` }, l.name),
        h("div", { class:"text-xs text-muted text-mono mt-sm" }, `${l.count || 0} contacts`),
        l.description ? h("div", { class:"text-sm text-muted mt-sm" }, l.description) : null,
      ),
      h("div", { class:"row" },
        h("button", { class:"btn sm", onclick: () => startPowerWithList(l.id) }, "Power Dial"),
        h("button", { class:"btn sm", onclick: () => editList(l) }, "Edit"),
        h("button", { class:"btn sm danger", onclick: async () => {
          if (!confirm(`Delete list "${l.name}"?`)) return;
          await api.del(`/api/lists/${l.id}`);
          await loadLists(); renderLists();
        } }, "Delete"),
      ),
    );
    wrap.appendChild(card);
  });
}
function editList(l={}) {
  const isNew = !l.id;
  const f = {
    name:  h("input", { class:"input", value: l.name || "" }),
    color: h("input", { class:"input", type:"color", value: l.color || "#00e5b0", style:"height:40px" }),
    desc:  h("textarea", { class:"textarea" }, l.description || ""),
  };
  modal({
    title: isNew ? "New List" : "Edit List",
    body: [
      h("div", { class:"field" }, h("label", {}, "Name"), f.name),
      h("div", { class:"field" }, h("label", {}, "Color"), f.color),
      h("div", { class:"field" }, h("label", {}, "Description"), f.desc),
    ],
    footer: [
      h("button", { class:"btn", onclick: closeModal }, "Cancel"),
      h("button", { class:"btn primary", onclick: async () => {
        const body = { name: f.name.value, color: f.color.value, description: f.desc.value };
        if (isNew) await api.post("/api/lists", body);
        else await api.patch(`/api/lists/${l.id}`, body);
        closeModal();
        await loadLists(); renderLists();
      } }, isNew ? "Create" : "Save"),
    ],
  });
}

// ── History ─────────────────────────────────────────────
async function loadCalls() {
  state.calls = await api.get("/api/calls?limit=200");
  const tbody = $("#calls-tbody");
  tbody.innerHTML = "";
  if (!state.calls.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="em-icon">☏</div>No calls yet.</div></td></tr>`;
    return;
  }
  state.calls.forEach(c => {
    const dispPill = c.disposition_name
      ? `<span class="disposition-pill" style="border-color:${c.disposition_color};color:${c.disposition_color}">${escapeHtml(c.disposition_name)}</span>`
      : `<span class="text-muted text-xs">—</span>`;
    const tr = h("tr", {},
      h("td", { class:"cell-mono cell-muted" }, fmtTime(c.started_at)),
      h("td", { html: c.contact_name ? `<b>${escapeHtml(c.contact_name)}</b>` : `<span class="text-muted">—</span>` }),
      h("td", { class:"cell-mono" }, c.to_number),
      h("td", { class:"cell-mono" }, fmtDur(c.duration||0)),
      h("td", { class:"cell-mono cell-muted" }, "$" + (c.cost||0).toFixed(4)),
      h("td", { html: dispPill }),
      h("td", { class:"actions" },
        iconBtn("phone", () => quickCall(c.to_number, c.contact_id, c.contact_name)),
        iconBtn("note",  () => openCallNotesModal(c)),
        c.recording_url ? iconBtn("play", () => window.open(c.recording_url, "_blank")) : null,
        iconBtn("trash", async () => {
          if (!confirm("Delete call entry?")) return;
          await api.del(`/api/calls/${c.id}`);
          loadCalls();
        }, "danger"),
      ),
    );
    tbody.appendChild(tr);
  });
}

function openCallNotesModal(c) {
  const notes = h("textarea", { class:"textarea" }, c.notes || "");
  const transcript = h("textarea", { class:"textarea", style:"min-height:140px" }, c.transcript || "");
  const dispSelect = h("select", { class:"select" },
    h("option", { value:"" }, "— none —"),
    ...state.dispositions.map(d => h("option", { value: d.id, ...(c.disposition_id == d.id ? { selected:true } : {}) }, d.name)),
  );
  modal({
    title: "Call Details",
    large: true,
    body: [
      h("div", { class:"row gap-md" },
        h("div", { class:"field", style:"flex:1" }, h("label", {}, "Number"), h("input", { class:"input input-mono", value:c.to_number, disabled:true })),
        h("div", { class:"field", style:"flex:1" }, h("label", {}, "Duration"), h("input", { class:"input input-mono", value:fmtDur(c.duration||0), disabled:true })),
        h("div", { class:"field", style:"flex:1" }, h("label", {}, "Cost"), h("input", { class:"input input-mono", value:"$"+(c.cost||0).toFixed(4), disabled:true })),
      ),
      h("div", { class:"field" }, h("label", {}, "Disposition"), dispSelect),
      h("div", { class:"field" }, h("label", {}, "Notes"), notes),
      h("div", { class:"field" }, h("label", {}, "Transcript"), transcript),
    ],
    footer: [
      h("button", { class:"btn", onclick: closeModal }, "Close"),
      h("button", { class:"btn primary", onclick: async () => {
        await api.patch(`/api/calls/${c.id}`, {
          notes: notes.value,
          transcript: transcript.value,
          disposition_id: dispSelect.value || null,
        });
        closeModal(); loadCalls(); toast("Saved");
      } }, "Save"),
    ],
  });
}

// ── SMS ─────────────────────────────────────────────────
async function loadSms() {
  state.sms = await api.get("/api/sms");
  // group by phone
  state.smsThreads = {};
  state.sms.forEach(m => {
    const peer = m.direction === "outbound" ? m.to_number : m.from_number;
    if (!state.smsThreads[peer]) state.smsThreads[peer] = [];
    state.smsThreads[peer].push(m);
  });
  Object.values(state.smsThreads).forEach(arr => arr.reverse());
}
function renderSmsThreads() {
  const list = $("#sms-thread-list");
  list.innerHTML = "";
  const peers = Object.keys(state.smsThreads);
  if (!peers.length) {
    list.innerHTML = `<div class="empty"><div class="em-icon">✉</div>No messages yet.</div>`;
  } else {
    peers.sort((a,b) => state.smsThreads[b][state.smsThreads[b].length-1].sent_at - state.smsThreads[a][state.smsThreads[a].length-1].sent_at);
    peers.forEach(p => {
      const arr = state.smsThreads[p];
      const last = arr[arr.length-1];
      const name = last.contact_name || p;
      const div = h("div", { class:"sms-thread" + (state.activeThread===p?" active":""), onclick: () => { state.activeThread = p; renderSmsThreads(); renderSmsConversation(); } },
        h("div", { class:"top" }, h("span", { class:"name" }, name), h("span", { class:"when" }, fmtTime(last.sent_at))),
        h("div", { class:"preview" }, last.body),
      );
      list.appendChild(div);
    });
  }
  renderSmsConversation();
}
function renderSmsConversation() {
  const head = $("#sms-conv-head");
  const msgs = $("#sms-conv-msgs");
  if (!state.activeThread || !state.smsThreads[state.activeThread]) {
    head.textContent = "Select a thread or send a new message";
    msgs.innerHTML = `<div class="text-muted text-sm">No conversation selected</div>`;
    return;
  }
  head.textContent = state.activeThread;
  msgs.innerHTML = "";
  state.smsThreads[state.activeThread].forEach(m => {
    msgs.appendChild(h("div", { class:"sms-bubble " + (m.direction === "outbound" ? "out" : "in") },
      m.body, h("span", { class:"ts" }, fmtTime(m.sent_at)),
    ));
  });
  msgs.scrollTop = msgs.scrollHeight;
}

// ── Scheduled ───────────────────────────────────────────
async function loadScheduled() {
  state.scheduled = await api.get("/api/scheduled");
  const wrap = $("#scheduled-wrap");
  wrap.innerHTML = "";
  if (!state.scheduled.length) {
    wrap.innerHTML = `<div class="empty"><div class="em-icon">⏰</div>No scheduled callbacks.</div>`;
    return;
  }
  const now = Math.floor(Date.now()/1000);
  state.scheduled.forEach(s => {
    const due = s.scheduled_at <= now;
    const card = h("div", { class:"scheduled-item " + (due?"due":"") },
      h("div", { class:"when" }, fmtTime(s.scheduled_at)),
      h("div", { class:"body" },
        h("div", { class:"name" }, (s.contact_name || s.phone) + (due ? "  · DUE" : "")),
        s.note ? h("div", { class:"note" }, s.note) : null,
      ),
      h("button", { class:"btn sm primary", onclick: () => quickCall(s.phone, s.contact_id, s.contact_name) }, "Call now"),
      h("button", { class:"btn sm", onclick: async () => { await api.post(`/api/scheduled/${s.id}/done`); loadScheduled(); } }, "Done"),
      h("button", { class:"btn sm danger", onclick: async () => { await api.del(`/api/scheduled/${s.id}`); loadScheduled(); } }, "×"),
    );
    wrap.appendChild(card);
  });
}
function openScheduleModal() {
  const phone = h("input", { class:"input input-mono", placeholder:"+1..." });
  const when  = h("input", { class:"input", type:"datetime-local" });
  const note  = h("textarea", { class:"textarea" });
  modal({
    title: "Schedule Callback",
    body: [
      h("div", { class:"field" }, h("label", {}, "Phone"), phone),
      h("div", { class:"field" }, h("label", {}, "When"), when),
      h("div", { class:"field" }, h("label", {}, "Note"), note),
    ],
    footer: [
      h("button", { class:"btn", onclick: closeModal }, "Cancel"),
      h("button", { class:"btn primary", onclick: async () => {
        if (!phone.value || !when.value) return toast("phone & date required", "warn");
        const ts = Math.floor(new Date(when.value).getTime()/1000);
        await api.post("/api/scheduled", { phone: phone.value, scheduled_at: ts, note: note.value });
        closeModal(); loadScheduled(); toast("Scheduled");
      } }, "Save"),
    ],
  });
}

// ── Scripts ─────────────────────────────────────────────
async function loadScripts() {
  state.scripts = await api.get("/api/scripts");
  const wrap = $("#scripts-wrap");
  wrap.innerHTML = "";
  if (!state.scripts.length) {
    wrap.innerHTML = `<div class="empty"><div class="em-icon">✎</div>No scripts.</div>`;
    return;
  }
  state.scripts.forEach(s => {
    const card = h("div", { class:"script-card" },
      h("div", { class:"head" },
        h("div", {}, h("div", { class:"title" }, s.title), h("div", { class:"cat" }, s.category)),
        h("div", { class:"row gap-sm" },
          h("button", { class:"btn sm", onclick: () => editScript(s) }, "Edit"),
          h("button", { class:"btn sm danger", onclick: async () => { await api.del(`/api/scripts/${s.id}`); loadScripts(); } }, "×"),
        ),
      ),
      h("div", { class:"body" }, s.body),
    );
    wrap.appendChild(card);
  });
}
function editScript(s={}) {
  const isNew = !s.id;
  const title = h("input", { class:"input", value: s.title || "" });
  const cat   = h("input", { class:"input", value: s.category || "general" });
  const body  = h("textarea", { class:"textarea", style:"min-height:160px" }, s.body || "");
  modal({
    title: isNew ? "New Script" : "Edit Script",
    body: [
      h("div", { class:"field" }, h("label", {}, "Title"), title),
      h("div", { class:"field" }, h("label", {}, "Category"), cat),
      h("div", { class:"field" }, h("label", {}, "Body"), body),
    ],
    footer: [
      h("button", { class:"btn", onclick: closeModal }, "Cancel"),
      h("button", { class:"btn primary", onclick: async () => {
        const data = { title: title.value, category: cat.value, body: body.value };
        if (isNew) await api.post("/api/scripts", data);
        else await api.patch(`/api/scripts/${s.id}`, data);
        closeModal(); loadScripts();
      } }, "Save"),
    ],
  });
}

// ── Voicemail Drop ──────────────────────────────────────
let mediaRecorder = null, recChunks = [];
async function loadVoicemails() {
  state.voicemails = await api.get("/api/voicemails");
  const wrap = $("#voicemails-wrap");
  wrap.innerHTML = "";
  if (!state.voicemails.length) {
    wrap.innerHTML = `<div class="empty"><div class="em-icon">▶</div>No voicemails recorded.</div>`;
    return;
  }
  state.voicemails.forEach(v => {
    const audio = h("audio", { controls:true, src:`/uploads/${v.audio_path}` });
    wrap.appendChild(h("div", { class:"vm-card" },
      h("div", { class:"name" }, v.name),
      audio,
      h("button", { class:"btn sm danger", onclick: async () => {
        await api.del(`/api/voicemails/${v.id}`); loadVoicemails();
      } }, "Delete"),
    ));
  });
}
async function toggleRecord() {
  const btn = $("#vm-record-btn");
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    btn.textContent = "● Record";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    recChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => recChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recChunks, { type: "audio/webm" });
      const name = prompt("Name this voicemail:", "Voicemail " + new Date().toLocaleString()) || "Voicemail";
      const fd = new FormData();
      fd.append("audio", blob, "vm.webm");
      fd.append("name", name);
      await api.upload("/api/voicemails", fd);
      stream.getTracks().forEach(t => t.stop());
      loadVoicemails();
      toast("Voicemail saved");
    };
    mediaRecorder.start();
    btn.textContent = "■ Stop";
  } catch(e) { toast("Microphone access denied", "error"); }
}

// ── DNC ─────────────────────────────────────────────────
async function loadDnc() {
  state.dnc = await api.get("/api/dnc");
  const tbody = $("#dnc-tbody");
  tbody.innerHTML = "";
  if (!state.dnc.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty">No blocked numbers.</div></td></tr>`;
    return;
  }
  state.dnc.forEach(d => {
    const tr = h("tr", {},
      h("td", { class:"cell-mono" }, d.phone),
      h("td", {}, d.reason || "—"),
      h("td", { class:"cell-mono cell-muted" }, fmtDate(d.added_at)),
      h("td", { class:"actions" }, iconBtn("trash", async () => {
        await api.del(`/api/dnc/${d.id}`); loadDnc();
      }, "danger")),
    );
    tbody.appendChild(tr);
  });
}

// ── Settings ────────────────────────────────────────────
async function renderSettings() {
  await loadSystem();
  const sys = state.system;
  $("#provider-list").innerHTML = "";
  Object.entries(sys.providers).forEach(([name, info]) => {
    $("#provider-list").appendChild(h("div", { class:"provider-card" },
      h("div", { class:"name" }, name.toUpperCase()),
      h("div", { class:"status" + (info.configured ? " text-accent" : " text-muted") },
        info.configured ? (info.webrtc_ready ? "READY (WebRTC)" : "READY") : "NOT CONFIGURED"),
    ));
  });
  $("#provider-select").value = sys.active_setting || "auto";
  $("#agent-name-input").value = sys.agent_name || "";
  $("#company-name-input").value = sys.company_name || "";

  // dispositions list
  const dWrap = $("#dispositions-list");
  dWrap.innerHTML = "";
  state.dispositions.forEach(d => {
    dWrap.appendChild(h("div", { class:"row between", style:"padding:8px 12px;background:var(--s2);border-radius:8px;margin-bottom:6px" },
      h("div", { class:"row gap-sm" },
        h("span", { style:`width:10px;height:10px;border-radius:50%;background:${d.color};display:inline-block` }),
        h("span", {}, d.name),
        d.is_success ? h("span", { class:"badge badge-green" }, "success") : null,
      ),
      h("button", { class:"btn sm danger", onclick: async () => {
        await api.del(`/api/dispositions/${d.id}`); state.dispositions = await api.get("/api/dispositions"); renderSettings();
      } }, "×"),
    ));
  });
}

// ── Analytics ───────────────────────────────────────────
async function loadAnalytics() {
  const stats = await api.get("/api/stats");
  $("#a-total-calls").textContent = stats.total_calls;
  $("#a-total-min").textContent = stats.total_minutes;
  $("#a-total-cost").textContent = "$" + stats.total_cost.toFixed(2);
  $("#a-unique").textContent = stats.unique_contacts;

  // calls per day chart
  const labels = stats.series.map(s => s.day);
  const calls = stats.series.map(s => s.calls);
  const cost = stats.series.map(s => +s.cost);
  if (state.charts.calls) state.charts.calls.destroy();
  state.charts.calls = new Chart($("#chart-calls").getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [
      { label: "Calls", data: calls, backgroundColor: "rgba(0,229,176,.55)", borderColor: "#00e5b0", borderWidth: 1, borderRadius: 6, yAxisID:"y" },
      { label: "Cost ($)", data: cost, type:"line", borderColor: "#a78bfa", backgroundColor:"rgba(167,139,250,.1)", tension:.3, yAxisID:"y1" },
    ]},
    options: {
      plugins: { legend: { labels: { color:"#cbd5e1", font:{family:"JetBrains Mono", size:10} } } },
      scales: {
        x: { ticks:{color:"#64748b", font:{size:10}}, grid:{color:"rgba(255,255,255,0.04)"} },
        y: { ticks:{color:"#64748b", font:{size:10}}, grid:{color:"rgba(255,255,255,0.04)"} },
        y1: { position:"right", ticks:{color:"#a78bfa", font:{size:10}}, grid:{display:false} },
      },
    },
  });

  // dispositions doughnut
  const dLabels = stats.dispositions.map(d => d.name);
  const dCounts = stats.dispositions.map(d => d.count);
  const dColors = stats.dispositions.map(d => d.color);
  if (state.charts.disp) state.charts.disp.destroy();
  state.charts.disp = new Chart($("#chart-disp").getContext("2d"), {
    type: "doughnut",
    data: { labels: dLabels, datasets: [{ data: dCounts, backgroundColor: dColors, borderColor:"#0e1219", borderWidth:2 }] },
    options: { plugins: { legend:{ position:"right", labels:{color:"#cbd5e1", font:{size:10}} } } },
  });

  // top contacts
  const tWrap = $("#top-contacts");
  tWrap.innerHTML = "";
  if (!stats.top_contacts.length) tWrap.innerHTML = `<div class="text-muted text-sm">No data yet.</div>`;
  stats.top_contacts.forEach((c,i) => {
    tWrap.appendChild(h("div", { class:"mini-item" },
      h("div", { class:"mini-avatar" }, "#" + (i+1)),
      h("div", { class:"mini-content" },
        h("div", { class:"mini-name" }, c.name || c.phone),
        h("div", { class:"mini-meta" }, `${c.calls} calls · ${fmtDur(c.seconds)}`),
      ),
    ));
  });
}

// ── Power dialer ────────────────────────────────────────
function renderPower() {
  const select = $("#power-list-select");
  select.innerHTML = `<option value="">— pick a list —</option>` +
    state.lists.map(l => `<option value="${l.id}">${escapeHtml(l.name)} (${l.count||0})</option>`).join("");
  $("#power-current").innerHTML = state.power.running ? "" : `<div class="text-muted">Pick a list and click Start.</div>`;
  renderPowerQueue();
}
async function startPowerWithList(lid) {
  navigate("power");
  $("#power-list-select").value = lid;
  await startPower();
}
async function startPower() {
  const lid = +$("#power-list-select").value;
  if (!lid) return toast("Pick a list", "warn");
  const contacts = await api.get("/api/contacts?list_id=" + lid);
  if (!contacts.length) return toast("List is empty", "warn");
  state.power = { running:true, queue: contacts, idx: -1, listId: lid, sessionStart: Date.now(), autoNext: $("#power-auto").checked };
  renderPowerQueue();
  powerNext();
}
function stopPower() {
  state.power.running = false;
  if (state.activeCall) endActiveCall();
  $("#power-current").innerHTML = `<div class="text-muted">Stopped.</div>`;
  renderPowerQueue();
}
async function powerNext() {
  if (!state.power.running) return;
  state.power.idx += 1;
  if (state.power.idx >= state.power.queue.length) {
    state.power.running = false;
    $("#power-current").innerHTML = `<div class="empty"><div class="em-icon">✓</div>List finished. ${state.power.queue.length} contacts dialed.</div>`;
    renderPowerQueue();
    toast("Power dial complete");
    return;
  }
  const c = state.power.queue[state.power.idx];
  $("#power-current").innerHTML = "";
  $("#power-current").appendChild(h("div", {},
    h("div", { class:"power-avatar" }, initials(c.name||c.phone)),
    h("div", { class:"power-name" }, c.name || "(no name)"),
    h("div", { class:"power-phone" }, c.phone),
    h("div", { class:"power-progress" }, h("div", { class:"power-progress-bar", style:`width:${(state.power.idx+1)/state.power.queue.length*100}%` })),
    h("div", { class:"text-mono text-xs text-muted" }, `${state.power.idx+1} of ${state.power.queue.length}`),
    h("div", { class:"row gap-sm mt-md", style:"justify-content:center" },
      h("button", { class:"btn primary", onclick: () => doPowerCall(c) }, "Call now"),
      h("button", { class:"btn", onclick: () => powerNext() }, "Skip →"),
      h("button", { class:"btn danger", onclick: stopPower }, "Stop"),
    ),
  ));
  renderPowerQueue();
  if (state.power.autoNext) setTimeout(() => doPowerCall(c), 800);
}
async function doPowerCall(c) {
  try {
    const res = await api.post("/api/call", { to: c.phone, contact_id: c.id });
    if (res.error) throw new Error(res.error);
    dialer.currentCallId = res.call_id;
    startActiveCall({ to: c.phone, country: res.country, provider: res.provider, callId: res.call_id, name: c.name });
  } catch(e) { toast("Call failed: " + e.message, "error"); }
}
function renderPowerQueue() {
  const wrap = $("#power-queue");
  wrap.innerHTML = `<div class="section-title">Queue (${state.power.queue.length})</div>`;
  state.power.queue.forEach((c,i) => {
    wrap.appendChild(h("div", {
      class: "queue-item " + (i === state.power.idx ? "current" : i < state.power.idx ? "done" : "")
    },
      h("div", { class:"queue-num" }, "#" + (i+1)),
      h("div", { class:"queue-name" }, c.name || "(no name)"),
      h("div", { class:"queue-phone" }, c.phone),
    ));
  });
}

// ── Socket ──────────────────────────────────────────────
let socket = null;
function initSocket() {
  socket = io({ transports: ["polling"] });
  socket.on("connect", () => {});
  socket.on("call_updated", (c) => {
    if (state.activeCall && c.id === state.activeCall.callId) {
      // possibly update timer if completed
    }
    if ($("#page-history").classList.contains("active")) loadCalls();
  });
  socket.on("sms_received", async () => {
    await loadSms();
    if ($("#page-sms").classList.contains("active")) renderSmsThreads();
    toast("New SMS received");
    loadRightPaneData();
  });
}

// ── Keyboard shortcuts ──────────────────────────────────
function initShortcuts() {
  document.addEventListener("keydown", (e) => {
    // ignore typing in inputs
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      // but allow keypad in dialer view
      const inDialer = $("#page-dialer").classList.contains("active") && e.target === $("#number-input");
      if (!inDialer) return;
    }
    if (e.altKey && e.key === "1") { navigate("dialer"); e.preventDefault(); }
    if (e.altKey && e.key === "2") { navigate("power"); e.preventDefault(); }
    if (e.altKey && e.key === "3") { navigate("contacts"); e.preventDefault(); }
    if (e.altKey && e.key === "4") { navigate("history"); e.preventDefault(); }
    if (e.altKey && e.key === "5") { navigate("sms"); e.preventDefault(); }
    if (e.altKey && e.key === "9") { navigate("analytics"); e.preventDefault(); }
    if (e.key === "Escape") { closeModal(); }
    // numpad keys to dialer
    if ($("#page-dialer").classList.contains("active") && /^[0-9*#]$/.test(e.key)) {
      const k = $(`.key[data-k="${e.key}"]`);
      if (k && document.activeElement !== $("#number-input")) {
        k.classList.add("pressed"); setTimeout(() => k.classList.remove("pressed"), 100);
        dialer.press(e.key);
      }
    }
    if ($("#page-dialer").classList.contains("active") && e.key === "Enter" && document.activeElement !== $("#number-input")) {
      dialer.call();
    }
  });
}

// ── Boot ────────────────────────────────────────────────
async function boot() {
  $$(".nav-item").forEach(n => n.addEventListener("click", () => navigate(n.dataset.page)));
  $("#modal-back").addEventListener("click", e => { if (e.target.id === "modal-back") closeModal(); });
  initSocket();
  initShortcuts();
  initSpeech();
  dialer.init();

  await loadSystem();
  state.dispositions = await api.get("/api/dispositions");
  await Promise.all([loadContacts(), loadLists(), loadSms()]);
  await loadRightPaneData();

  // Settings page handlers
  $("#provider-select-save").addEventListener("click", async () => {
    await api.post("/api/system", {
      active_provider: $("#provider-select").value,
      agent_name: $("#agent-name-input").value,
      company_name: $("#company-name-input").value,
    });
    await loadSystem();
    toast("Settings saved");
  });
  $("#new-disposition-btn").addEventListener("click", () => {
    const name = h("input", { class:"input" });
    const color = h("input", { class:"input", type:"color", value:"#64748b", style:"height:40px" });
    const success = h("input", { type:"checkbox" });
    modal({ title:"New Disposition", body: [
      h("div", { class:"field" }, h("label", {}, "Name"), name),
      h("div", { class:"field" }, h("label", {}, "Color"), color),
      h("div", { class:"field" }, h("label", {}, "Counts as success"), success),
    ], footer: [
      h("button", { class:"btn", onclick: closeModal }, "Cancel"),
      h("button", { class:"btn primary", onclick: async () => {
        await api.post("/api/dispositions", { name: name.value, color: color.value, is_success: success.checked });
        state.dispositions = await api.get("/api/dispositions");
        closeModal(); renderSettings();
      } }, "Save"),
    ]});
  });

  // Contacts handlers
  $("#new-contact-btn").addEventListener("click", () => openContactModal({}));
  $("#contacts-search").addEventListener("input", e => renderContacts(e.target.value));
  $("#export-csv-btn").addEventListener("click", () => window.location.href = "/api/contacts/export");
  $("#import-csv-input").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    const r = await fetch("/api/contacts/import", { method:"POST", headers:{"Content-Type":"text/csv"}, body:text });
    const j = await r.json();
    toast(`Imported ${j.inserted}, skipped ${j.skipped}`);
    e.target.value = "";
    await loadContacts(); renderContacts();
  });

  // Lists
  $("#new-list-btn").addEventListener("click", () => editList({}));

  // SMS
  $("#sms-send-btn").addEventListener("click", async () => {
    const to = $("#sms-to-input").value.trim() || state.activeThread;
    const body = $("#sms-body-input").value;
    if (!to || !body) return toast("to & message required", "warn");
    await api.post("/api/sms", { to, body });
    $("#sms-body-input").value = "";
    await loadSms();
    state.activeThread = to;
    renderSmsThreads();
    loadRightPaneData();
  });

  // Scheduled
  $("#new-scheduled-btn").addEventListener("click", openScheduleModal);

  // Scripts
  $("#new-script-btn").addEventListener("click", () => editScript({}));

  // Voicemail
  $("#vm-record-btn").addEventListener("click", toggleRecord);

  // DNC
  $("#new-dnc-btn").addEventListener("click", () => {
    const phone = h("input", { class:"input input-mono", placeholder:"+1..." });
    const reason = h("input", { class:"input", placeholder:"reason" });
    modal({ title:"Block Number", body: [
      h("div", { class:"field" }, h("label", {}, "Phone"), phone),
      h("div", { class:"field" }, h("label", {}, "Reason"), reason),
    ], footer: [
      h("button", { class:"btn", onclick: closeModal }, "Cancel"),
      h("button", { class:"btn primary", onclick: async () => {
        await api.post("/api/dnc", { phone: phone.value, reason: reason.value });
        closeModal(); loadDnc();
      } }, "Block"),
    ]});
  });

  // Power dialer controls
  $("#power-start-btn").addEventListener("click", startPower);
  $("#power-stop-btn").addEventListener("click", stopPower);

  // Initial route
  navigate("dialer");

  // Auto-refresh stats every 20s
  setInterval(loadRightPaneData, 20000);
}

window.addEventListener("DOMContentLoaded", boot);
})();
