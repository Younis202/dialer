"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, ListOrdered, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ListsPage() {
  const { data, mutate } = useSWR<any[]>("/api/lists", fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#10e6a5", description: "" });

  async function create() {
    if (!form.name) return toast.error("Name required");
    await fetch("/api/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    toast.success("List created");
    setOpen(false); setForm({ name: "", color: "#10e6a5", description: "" });
    mutate();
  }

  async function remove(id: number) {
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    mutate(); toast.success("Deleted");
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Lists"
        subtitle="Group contacts for power dialing campaigns"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />New List</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((l) => (
          <div key={l.id} className="data-card group">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${l.color}22`, color: l.color }}>
                <ListOrdered className="h-5 w-5" />
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => remove(l.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="font-display text-base font-semibold">{l.name}</div>
            {l.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.description}</div>}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">CONTACTS</span>
              <span className="font-mono text-sm">{l.count}</span>
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <div className="col-span-full data-card text-center py-12 text-muted-foreground">No lists yet</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New List</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VIP Leads" /></div>
            <div className="space-y-1.5"><Label>Color</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
