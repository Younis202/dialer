"use client";
import { use, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Phone, Play, ArrowLeft, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { parsePhone } from "@/lib/phone";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, mutate } = useSWR<any>(`/api/lists/${id}`, fetcher);
  const { data: allContacts } = useSWR<any[]>("/api/contacts", fetcher);
  const [open, setOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");

  if (!data) return <div className="p-6">Loading…</div>;
  if (data.error) return <div className="p-6">List not found</div>;

  const memberIds = new Set<number>(data.members.map((m: any) => m.id));
  const candidates = (allContacts ?? []).filter((c) => !memberIds.has(c.id) && (
    !pickerQ || (c.name || "").toLowerCase().includes(pickerQ.toLowerCase()) || c.phone.includes(pickerQ)
  ));

  async function add(contactId: number) {
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add", contactId }),
    });
    mutate();
  }

  async function remove(contactId: number) {
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", contactId }),
    });
    mutate();
    toast.success("Removed");
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => router.push("/lists")} className="mb-3">
        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back
      </Button>
      <PageHeader
        title={data.list.name}
        subtitle={`${data.members.length} contacts`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Contact
            </Button>
            <Button size="sm" onClick={() => router.push(`/power?list=${id}`)}>
              <Play className="h-3.5 w-3.5 mr-1.5" />Power Dial
            </Button>
          </>
        }
      />

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-3 px-4 w-12"></th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Company</th>
              <th className="py-3 px-4 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((c: any) => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-accent/30">
                <td className="py-3 px-4"><Flag country={c.country} size="sm" /></td>
                <td className="py-3 px-4 font-medium">{c.name || "—"}</td>
                <td className="py-3 px-4 font-mono text-xs">{c.phone}</td>
                <td className="py-3 px-4 text-muted-foreground">{c.company || "—"}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/?dial=${encodeURIComponent(c.phone)}`)}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {data.members.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No contacts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add to List</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search…" className="pl-9" />
          </div>
          <div className="max-h-80 overflow-y-auto -mx-2">
            {candidates.slice(0, 50).map((c) => {
              const p = parsePhone(c.phone);
              return (
                <button key={c.id} onClick={() => add(c.id)} className="w-full text-left p-2 rounded-lg hover:bg-accent/40 flex items-center gap-2.5">
                  <Flag country={p.country} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{c.name || c.phone}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{c.phone}</div>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
            {candidates.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No more contacts to add</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
