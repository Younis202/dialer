"use client";
import { useState } from "react";
import useSWR from "swr";
import { FileText, Plus, Trash2, Edit3 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ScriptsPage() {
  const { data, mutate } = useSWR<any[]>("/api/scripts", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", body: "" });

  function openNew() {
    setEditing(null);
    setForm({ title: "", body: "Hi {{name}}, this is __ from __. We help {{company}}…" });
    setOpen(true);
  }
  function openEdit(s: any) {
    setEditing(s);
    setForm({ title: s.title, body: s.body });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return;
    if (editing) {
      await fetch(`/api/scripts/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    mutate();
    setOpen(false);
    toast.success(editing ? "Script updated" : "Script created");
  }

  async function remove(id: number) {
    await fetch(`/api/scripts/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Call Scripts"
        subtitle="Reusable scripts with {{name}} and {{company}} placeholders"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New Script
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data?.map((s) => (
          <div key={s.id} className="data-card flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.title}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {s.body.length} chars
                </div>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-5 leading-relaxed">
              {s.body}
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(Array.from(s.body.matchAll(/\{\{(\w+)\}\}/g)).map((m: any) => m[1]))).map((v: any) => (
                <Badge key={v} variant="outline" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>
              ))}
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <div className="data-card md:col-span-2 py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
            <div className="text-sm text-muted-foreground">No scripts yet</div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Script</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Cold call opener" />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
              <div className="text-[10px] text-muted-foreground">
                Use <code className="font-mono bg-card/60 px-1 rounded">{`{{name}}`}</code>, <code className="font-mono bg-card/60 px-1 rounded">{`{{company}}`}</code>, <code className="font-mono bg-card/60 px-1 rounded">{`{{phone}}`}</code> as placeholders.
              </div>
            </div>
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
