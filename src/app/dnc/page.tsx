"use client";
import { useState } from "react";
import useSWR from "swr";
import { ShieldOff, Plus, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "@/components/ui/flag";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { parsePhone } from "@/lib/phone";
import { formatRelative } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function DNCPage() {
  const { data, mutate } = useSWR<any[]>("/api/dnc", fetcher);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  async function add() {
    if (!phone.trim()) return;
    const parsed = parsePhone(phone);
    const res = await fetch("/api/dnc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: parsed.e164 || phone, reason }),
    });
    if (res.ok) {
      mutate();
      setOpen(false); setPhone(""); setReason("");
      toast.success("Added to DNC");
    }
  }

  async function remove(id: number) {
    await fetch(`/api/dnc/${id}`, { method: "DELETE" });
    mutate();
    toast.success("Removed from DNC");
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Do Not Call"
        subtitle="DIALR will block any outbound call to numbers on this list"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Number
          </Button>
        }
      />

      <div className="surface p-4 mb-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          Adding numbers here is a hard block. Outbound calls and SMS to DNC numbers will be rejected
          with a 403 by the API. This list is also used by Power Dialer auto-skipping.
        </div>
      </div>

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-3 px-4 w-12"></th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Added</th>
              <th className="py-3 px-4 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((d) => {
              const p = parsePhone(d.phone);
              return (
                <tr key={d.id} className="border-b border-border/30 hover:bg-accent/30">
                  <td className="py-3 px-4"><Flag country={p.country} size="sm" /></td>
                  <td className="py-3 px-4 font-mono text-xs">{d.phone}</td>
                  <td className="py-3 px-4 text-muted-foreground">{d.reason || "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{formatRelative(d.addedAt)}</td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  <ShieldOff className="h-10 w-10 mx-auto mb-3 opacity-40" strokeWidth={1.2} />
                  <div>No numbers blocked</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to Do Not Call</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
