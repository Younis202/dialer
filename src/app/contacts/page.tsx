"use client";
import { useState } from "react";
import useSWR from "swr";
import { Plus, Phone, MessageSquare, Star, Search, Trash2, Edit3, Upload, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { parsePhone } from "@/lib/phone";
import { formatRelative } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ContactsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", notes: "", tags: "" });
  const { data: contacts, mutate } = useSWR<any[]>(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`, fetcher);

  function openNew() {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", company: "", notes: "", tags: "" });
    setOpen(true);
  }
  function openEdit(c: any) {
    setEditing(c);
    setForm({ name: c.name || "", phone: c.phone, email: c.email || "", company: c.company || "", notes: c.notes || "", tags: c.tags || "" });
    setOpen(true);
  }

  async function save() {
    if (!form.phone) return toast.error("Phone is required");
    const parsed = parsePhone(form.phone);
    const payload = { ...form, phone: parsed.e164 || form.phone, country: parsed.country };
    if (editing) {
      await fetch(`/api/contacts/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      toast.success("Contact updated");
    } else {
      await fetch("/api/contacts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      toast.success("Contact added");
    }
    setOpen(false);
    mutate();
  }

  async function remove(id: number) {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    mutate();
    toast.success("Contact deleted");
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("number"));
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const companyIdx = header.findIndex((h) => h.includes("company"));
    let n = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const phone = cols[phoneIdx];
      if (!phone) continue;
      const parsed = parsePhone(phone);
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: parsed.e164 || phone,
          name: nameIdx >= 0 ? cols[nameIdx] : "",
          email: emailIdx >= 0 ? cols[emailIdx] : "",
          company: companyIdx >= 0 ? cols[companyIdx] : "",
          country: parsed.country,
        }),
      });
      n++;
    }
    toast.success(`Imported ${n} contacts`);
    mutate();
  }

  function exportCsv() {
    if (!contacts || !contacts.length) return;
    const header = "name,phone,email,company,country,tags";
    const rows = contacts.map((c) => [c.name, c.phone, c.email, c.company, c.country, c.tags].map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dialr-contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Contacts"
        subtitle={`${contacts?.length ?? 0} people in your address book`}
        actions={
          <>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="h-3.5 w-3.5 mr-1.5" />Import</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
            <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1.5" />New Contact</Button>
          </>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, company…" className="pl-9" />
      </div>

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-3 px-4 w-8"></th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Company</th>
              <th className="py-3 px-4">Last Called</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts?.map((c) => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                <td className="py-3 px-4">{c.favorite && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}</td>
                <td className="py-3 px-4 font-medium">{c.name || <span className="text-muted-foreground">—</span>}</td>
                <td className="py-3 px-4 font-mono text-xs">{c.phone}</td>
                <td className="py-3 px-4 text-muted-foreground">{c.company || "—"}</td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{c.lastCalledAt ? formatRelative(c.lastCalledAt) : "—"}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/?dial=${encodeURIComponent(c.phone)}`)}><Phone className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon"><MessageSquare className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit3 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {contacts && contacts.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">No contacts yet. Click "New Contact" to add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Contact" : "New Contact"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
            <div className="space-y-1.5"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 123 4567" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@acme.com" /></div>
            <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc" /></div>
            <div className="space-y-1.5"><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, lead, customer" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
