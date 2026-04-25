"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Plus, FileText, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ScriptsPage() {
  const { data, mutate } = useSWR<any[]>("/api/scripts", fetcher);
  const [active, setActive] = useState<any>(null);
  const [draft, setDraft] = useState({ title: "", body: "", category: "general" });

  useEffect(() => {
    if (active) setDraft({ title: active.title, body: active.body, category: active.category });
  }, [active]);

  async function newScript() {
    const res = await fetch("/api/scripts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Untitled", body: "Hi {{name}}, this is …", category: "general" }) });
    const r = await res.json();
    mutate(); setActive(r);
  }

  async function save() {
    if (!active) return;
    await fetch(`/api/scripts/${active.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    toast.success("Saved");
    mutate();
  }

  async function remove() {
    if (!active) return;
    await fetch(`/api/scripts/${active.id}`, { method: "DELETE" });
    setActive(null); mutate();
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Scripts"
        subtitle="Reusable templates with {{variables}} for in-call use"
        actions={<Button size="sm" onClick={newScript}><Plus className="h-3.5 w-3.5 mr-1.5" />New Script</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div className="data-card !p-2 max-h-[600px] overflow-y-auto">
          {data?.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className={`w-full text-left rounded-lg p-3 transition-colors ${active?.id === s.id ? "bg-accent" : "hover:bg-accent/40"}`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-sm truncate">{s.title}</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">{s.category}</div>
            </button>
          ))}
          {data && data.length === 0 && <div className="p-6 text-center text-muted-foreground text-xs">No scripts</div>}
        </div>

        <div className="data-card">
          {active ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="text-lg font-display font-semibold border-0 bg-transparent !text-lg p-0 h-auto" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1.5" />Save</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={20} className="font-mono text-sm" />
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-muted-foreground text-sm">Select or create a script</div>
          )}
        </div>
      </div>
    </div>
  );
}
