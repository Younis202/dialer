"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Save, Eye, EyeOff, ShieldCheck, ShieldOff, Wifi } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useSip } from "@/components/shell/sip-provider";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function SettingsPage() {
  const { data, mutate } = useSWR<any>("/api/settings", fetcher);
  const sip = useSip();

  const [voipUser, setVoipUser] = useState("");
  const [voipPass, setVoipPass] = useState("");
  const [voipServer, setVoipServer] = useState("atlanta.voip.ms");
  const [voipApiUser, setVoipApiUser] = useState("");
  const [voipApiPass, setVoipApiPass] = useState("");
  const [voipDid, setVoipDid] = useState("");
  const [callerId, setCallerId] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showApiPass, setShowApiPass] = useState(false);

  useEffect(() => {
    if (!data) return;
    setVoipUser(data.voipmsUser || "");
    setVoipPass(data.voipmsPass || "");
    setVoipServer(data.voipmsServer || "atlanta.voip.ms");
    setVoipApiUser(data.voipmsApiUser || "");
    setVoipApiPass(data.voipmsApiPass || "");
    setVoipDid(data.voipmsDid || "");
    setCallerId(data.callerId || "");
  }, [data]);

  async function save() {
    const t = toast.loading("Saving…");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        voipmsUser: voipUser,
        voipmsPass: voipPass,
        voipmsServer: voipServer,
        voipmsApiUser: voipApiUser,
        voipmsApiPass: voipApiPass,
        voipmsDid: voipDid,
        callerId,
      }),
    });
    toast.dismiss(t);
    toast.success("Saved. SIP will re-register.");
    mutate();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="SIP, billing, and account" />

      <Tabs defaultValue="sip">
        <TabsList>
          <TabsTrigger value="sip">SIP / Voip.ms</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="sip" className="space-y-4">
          <div className="data-card flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              sip.registered ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            }`}>
              {sip.registered ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">
                {sip.registered ? "Registered with Voip.ms" : "Not registered"}
              </div>
              <div className="text-xs text-muted-foreground">
                {sip.registered
                  ? "You can place real outbound calls and receive inbound."
                  : "Add Voip.ms credentials below to enable calling."}
              </div>
            </div>
            <Badge variant={sip.registered ? "default" : "outline"} className="font-mono">
              {sip.state.toUpperCase()}
            </Badge>
          </div>

          <div className="data-card space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              SIP CREDENTIALS
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>SIP Username</Label><Input value={voipUser} onChange={(e) => setVoipUser(e.target.value)} placeholder="123456_account" /></div>
              <div className="space-y-1.5">
                <Label>SIP Password</Label>
                <div className="relative">
                  <Input type={showPass ? "text" : "password"} value={voipPass} onChange={(e) => setVoipPass(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5"><Label>SIP Server</Label><Input value={voipServer} onChange={(e) => setVoipServer(e.target.value)} placeholder="atlanta.voip.ms" /></div>
              <div className="space-y-1.5"><Label>Default DID</Label><Input value={voipDid} onChange={(e) => setVoipDid(e.target.value)} placeholder="+1 555 123 4567" /></div>
            </div>
          </div>

          <div className="data-card space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              VOIP.MS API (For SMS)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>API User</Label><Input value={voipApiUser} onChange={(e) => setVoipApiUser(e.target.value)} placeholder="email@example.com" /></div>
              <div className="space-y-1.5">
                <Label>API Password</Label>
                <div className="relative">
                  <Input type={showApiPass ? "text" : "password"} value={voipApiPass} onChange={(e) => setVoipApiPass(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowApiPass((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showApiPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate API credentials in your Voip.ms portal under "Main Menu → SOAP and REST/JSON API".
              Used to send and receive SMS via your DID.
            </p>
          </div>

          <Button onClick={save} className="w-full">
            <Save className="h-4 w-4 mr-2" />Save & Reconnect
          </Button>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <div className="data-card space-y-3">
            <div className="space-y-1.5">
              <Label>Caller ID Name</Label>
              <Input value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="John from Acme" />
            </div>
            <Button onClick={save}><Save className="h-4 w-4 mr-2" />Save</Button>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <div className="data-card space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              DIALR P2P NETWORK
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-success" />
              <span className="text-sm">Always-on, end-to-end encrypted via WebRTC + DTLS-SRTP</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Free calling between any two DIALR sessions. No SIP required.
              Manage your handle on the Network page.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
