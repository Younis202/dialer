"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Save, Phone, MessageSquare, KeyRound, User, Wifi } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function SettingsPage() {
  const { data, mutate } = useSWR<any>("/api/settings", fetcher);
  const [s, setS] = useState<any>({
    myNumber: "",
    sip: { uri: "", password: "", wsServer: "wss://atlanta1.voip.ms:443", displayName: "" },
    voipms: { user: "", password: "", subAccount: "" },
    twilio: { accountSid: "", authToken: "", phone: "" },
    telnyx: { apiKey: "", phone: "" },
    ai: { provider: "openai", apiKey: "" },
    preferences: { autoMute: false, recordCalls: false, transcription: true, vibration: true, language: "en" },
  });

  useEffect(() => { if (data) setS({ ...s, ...data }); /* eslint-disable-next-line */ }, [data]);

  async function save() {
    await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
    toast.success("Settings saved");
    mutate();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Configure your providers, SIP credentials, and preferences"
        actions={<Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1.5" />Save All</Button>}
      />

      <div className="space-y-4">
        <Section icon={User} title="Identity">
          <div className="space-y-1.5"><Label>My Number (caller ID)</Label><Input value={s.myNumber} onChange={(e) => setS({ ...s, myNumber: e.target.value })} placeholder="+1 669 222 2638" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Display Name</Label><Input value={s.sip.displayName} onChange={(e) => setS({ ...s, sip: { ...s.sip, displayName: e.target.value } })} placeholder="Your name" /></div>
            <div className="space-y-1.5"><Label>Language</Label><Input value={s.preferences.language} onChange={(e) => setS({ ...s, preferences: { ...s.preferences, language: e.target.value } })} placeholder="en, ar, es…" /></div>
          </div>
        </Section>

        <Section icon={Phone} title="SIP / Voip.ms (recommended for global calling)">
          <p className="text-xs text-muted-foreground -mt-1">Sign up at voip.ms → Sub Accounts → Create. Use your Sub Account username as URI.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>SIP URI</Label><Input value={s.sip.uri} onChange={(e) => setS({ ...s, sip: { ...s.sip, uri: e.target.value } })} placeholder="sip:123456_subname@atlanta1.voip.ms" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={s.sip.password} onChange={(e) => setS({ ...s, sip: { ...s.sip, password: e.target.value } })} /></div>
          </div>
          <div className="space-y-1.5"><Label>WSS Server</Label><Input value={s.sip.wsServer} onChange={(e) => setS({ ...s, sip: { ...s.sip, wsServer: e.target.value } })} /></div>
        </Section>

        <Section icon={MessageSquare} title="Voip.ms API (for SMS)">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>API User</Label><Input value={s.voipms.user} onChange={(e) => setS({ ...s, voipms: { ...s.voipms, user: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>API Password</Label><Input type="password" value={s.voipms.password} onChange={(e) => setS({ ...s, voipms: { ...s.voipms, password: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>DID (your DIDs)</Label><Input value={s.voipms.subAccount} onChange={(e) => setS({ ...s, voipms: { ...s.voipms, subAccount: e.target.value } })} placeholder="16692222638" /></div>
          </div>
        </Section>

        <Section icon={KeyRound} title="Twilio (optional fallback)">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Account SID</Label><Input value={s.twilio.accountSid} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, accountSid: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>Auth Token</Label><Input type="password" value={s.twilio.authToken} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, authToken: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={s.twilio.phone} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, phone: e.target.value } })} /></div>
          </div>
        </Section>

        <Section icon={Wifi} title="Telnyx (optional, cheapest US)">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>API Key</Label><Input type="password" value={s.telnyx.apiKey} onChange={(e) => setS({ ...s, telnyx: { ...s.telnyx, apiKey: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={s.telnyx.phone} onChange={(e) => setS({ ...s, telnyx: { ...s.telnyx, phone: e.target.value } })} /></div>
          </div>
        </Section>

        <Section icon={KeyRound} title="AI (optional — transcription & coach)">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Provider</Label><Input value={s.ai.provider} onChange={(e) => setS({ ...s, ai: { ...s.ai, provider: e.target.value } })} /></div>
            <div className="space-y-1.5"><Label>API Key</Label><Input type="password" value={s.ai.apiKey} onChange={(e) => setS({ ...s, ai: { ...s.ai, apiKey: e.target.value } })} /></div>
          </div>
        </Section>

        <Section icon={User} title="Preferences">
          <Toggle label="Auto-mute on join" v={s.preferences.autoMute} onChange={(v) => setS({ ...s, preferences: { ...s.preferences, autoMute: v } })} />
          <Toggle label="Record calls (where legal)" v={s.preferences.recordCalls} onChange={(v) => setS({ ...s, preferences: { ...s.preferences, recordCalls: v } })} />
          <Toggle label="Live transcription (Web Speech)" v={s.preferences.transcription} onChange={(v) => setS({ ...s, preferences: { ...s.preferences, transcription: v } })} />
          <Toggle label="Haptic feedback on keypad" v={s.preferences.vibration} onChange={(v) => setS({ ...s, preferences: { ...s.preferences, vibration: v } })} />
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="data-card space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 pt-2 border-t border-border/40">{children}</div>
    </div>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={v} onCheckedChange={onChange} />
    </div>
  );
}
