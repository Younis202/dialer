"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { CalendarClock, Plus, Trash2, Phone, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/ui/flag";
import { toast } from "@/components/ui/sonner";
import { parsePhone } from "@/lib/phone";
import { formatRelative } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function localIsoMin(d = new Date()) {
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 16);
}

export default function ScheduledPage() {
  const router = useRouter();
  const { data, mutate } = useSWR<any[]>("/api/scheduled", fetcher, { refreshInterval: 10000 });
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [when, setWhen] = useState("");
  useEffect(() => {
    setWhen(localIsoMin(new Date(Date.now() + 60 * 60 * 1000)));
  }, []);
  const [notes, setNotes] = useState("");

  async function create() {
    if (!phone.trim() || !when) return;
    const parsed = parsePhone(phone);
    await fetch("/api/scheduled", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: parsed.e164 || phone,
        name,
        scheduledFor: new Date(when).getTime(),
        notes,
      }),
    });
    setOpen(false);
    setPhone(""); setName(""); setNotes("");
    mutate();
    toast.success("Call scheduled");
  }

  async function remove(id: number) {
    await fetch(`/api/scheduled/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Scheduled Calls"
        subtitle="Reminders for callbacks. We'll buzz you when it's time."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Schedule
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.map((s) => {
          const p = parsePhone(s.phone);
          const due = s.scheduledFor < Date.now();
          return (
            <div key={s.id} className="data-card flex gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {due ? <Bell className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name || s.phone}</div>
                    <div className="font-mono text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Flag country={p.country} size="sm" />
                      {s.phone}
                    </div>
                  </div>
                  <Badge variant={due ? "default" : "outline"} className="shrink-0 text-[10px]">
                    {due ? "DUE" : new Date(s.scheduledFor).toLocaleString()}
                  </Badge>
                </div>
                {s.notes && <div className="text-xs text-muted-foreground mt-2">{s.notes}</div>}
                <div className="text-[10px] font-mono text-muted-foreground mt-3">
                  {formatRelative(s.scheduledFor)}
                </div>
                <div className="flex gap-1 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/?dial=${encodeURIComponent(s.phone)}`)}
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />Call
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {data && data.length === 0 && (
          <div className="data-card md:col-span-2 lg:col-span-3 py-16 text-center">
            <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
            <div className="text-sm text-muted-foreground">No scheduled calls</div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule a Call</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Phone *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 …" /></div>
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-1.5"><Label>When *</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
