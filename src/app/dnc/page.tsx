"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Ban, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { formatRelative } from "@/lib/utils";
import { parsePhone } from "@/lib/phone";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function DncPage() {
  const { data, mutate } = useSWR<any[]>("/api/dnc", fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", reason: "" });

  async function add() {
    if (!form.phone) return;
    const parsed = parsePhone(form.phone);
    await fetch("/api/dnc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: parsed.e164 || form.phone, reason: form.reason }),
    });
    toast.success("Added to DNC");
    setOpen(false); setForm({ phone: "", reason: "" });
    mutate();
  }

  async function remove(id: number) {
    await fetch(`/api/dnc?id=${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Do-Not-Call List"
        subtitle="Numbers blocked from dialing — your safety net for compliance"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Block Number</Button>}
      />

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-3 px-4 w-8"></th>
              <th className="py-3 px-4">Number</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Added</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((d) => (
              <tr key={d.id} className="border-b border-border/30 hover:bg-accent/30">
                <td className="py-3 px-4"><Ban className="h-3.5 w-3.5 text-destructive" /></td>
                <td className="py-3 px-4 font-mono">{d.phone}</td>
                <td className="py-3 px-4 text-muted-foreground">{d.reason || "—"}</td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{formatRelative(d.addedAt)}</td>
                <td className="py-3 px-4 text-right"><Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
            {data && data.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No blocked numbers</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Block Number</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
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
