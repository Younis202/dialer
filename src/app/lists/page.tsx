"use client";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users, Play, Edit3 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ListsPage() {
  const router = useRouter();
  const { data, mutate } = useSWR<any[]>("/api/lists", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setOpen(true);
  }
  function openEdit(l: any) {
    setEditing(l);
    setForm({ name: l.name, description: l.description || "" });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    if (editing) {
      await fetch(`/api/lists/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    mutate();
    setOpen(false);
    toast.success("Saved");
  }

  async function remove(id: number) {
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Lists"
        subtitle="Group contacts for power dialing campaigns"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New List
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.map((l) => (
          <div key={l.id} className="data-card group flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {l.contactCount ?? 0} contacts
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(l.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {l.description && (
              <div className="text-xs text-muted-foreground line-clamp-2">{l.description}</div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-auto"
              onClick={() => router.push(`/power?list=${l.id}`)}
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />Power Dial
            </Button>
          </div>
        ))}
        {data && data.length === 0 && (
          <div className="data-card sm:col-span-2 lg:col-span-3 py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
            <div className="text-sm text-muted-foreground">No lists yet</div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} List</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q4 Leads" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
