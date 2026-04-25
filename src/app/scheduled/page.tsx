"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Calendar, Trash2, Phone } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ScheduledPage() {
  const { data, mutate } = useSWR<any[]>("/api/scheduled", fetcher, { refreshInterval: 10000 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", scheduledAt: "", note: "" });

  async function create() {
    if (!form.phone || !form.scheduledAt) return toast.error("Phone & time required");
    await fetch("/api/scheduled", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: form.phone, scheduledAt: new Date(form.scheduledAt).getTime(), note: form.note }),
    });
    toast.success("Scheduled");
    setOpen(false); setForm({ phone: "", scheduledAt: "", note: "" });
    mutate();
  }

  async function remove(id: number) {
    await fetch(`/api/scheduled?id=${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Scheduled Calls"
        subtitle="Get reminded to call back at the right moment"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Schedule</Button>}
      />

      <div className="data-card !p-0 overflow-hidden">
        <div className="divide-y divide-border/30">
          {data?.map((s) => (
            <div key={s.id} className="p-4 flex items-center gap-4 hover:bg-accent/30">
              <div className="h-10 w-10 rounded-xl bg-info/10 text-info flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-sm">{s.phone}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.scheduledAt).toLocaleString()}
                  {s.note && <> · {s.note}</>}
                </div>
              </div>
              <Badge variant="outline">{s.status}</Badge>
              <Button variant="ghost" size="icon"><Phone className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {data && data.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">Nothing scheduled</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Call</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>When</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
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
