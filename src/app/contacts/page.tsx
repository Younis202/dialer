"use client";
import { useState } from "react";
import useSWR from "swr";
import {
  Plus, Phone, MessageSquare, Star, Search, Trash2, Edit3, Upload, Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shell/page-header";
import { Flag } from "@/components/ui/flag";
import { toast } from "@/components/ui/sonner";
import { parsePhone } from "@/lib/phone";
import { formatRelative } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (cell || cur.length) { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else cell += ch;
    }
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

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
    setForm({
      name: c.name || "", phone: c.phone, email: c.email || "",
      company: c.company || "", notes: c.notes || "", tags: c.tags || "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.phone) return toast.error("Phone is required");
    const parsed = parsePhone(form.phone);
    const payload = { ...form, phone: parsed.e164 || form.phone, country: parsed.country };
    if (editing) {
      await fetch(`/api/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Contact updated");
    } else {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
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
    const rows = parseCsv(text);
    if (rows.length === 0) return toast.error("Empty CSV");
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
    const phoneIdx = idx("phone", "number", "tel", "mobile");
    const nameIdx = idx("name", "first", "full");
    const emailIdx = idx("email", "mail");
    const companyIdx = idx("company", "organization", "org");
    const tagsIdx = idx("tags", "labels");

    if (phoneIdx < 0) return toast.error("CSV must include a 'phone' column");

    const items = rows.slice(1).map((cols) => {
      const phone = cols[phoneIdx]?.trim();
      if (!phone) return null;
      const parsed = parsePhone(phone);
      return {
        phone: parsed.e164 || phone,
        name: nameIdx >= 0 ? (cols[nameIdx] || "").trim() : "",
        email: emailIdx >= 0 ? (cols[emailIdx] || "").trim() : "",
        company: companyIdx >= 0 ? (cols[companyIdx] || "").trim() : "",
        tags: tagsIdx >= 0 ? (cols[tagsIdx] || "").trim() : "",
        country: parsed.country,
      };
    }).filter(Boolean);

    const t = toast.loading(`Importing ${items.length} contacts…`);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(items),
    });
    const data = await res.json();
    toast.dismiss(t);
    toast.success(`Imported ${data.inserted ?? items.length} contacts`);
    mutate();
  }

  function exportCsv() {
    if (!contacts || !contacts.length) return;
    const header = "name,phone,email,company,country,tags";
    const rows = contacts.map((c) =>
      [c.name, c.phone, c.email, c.company, c.country, c.tags]
        .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dialr-contacts.csv"; a.click();
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
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
              />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="h-3.5 w-3.5 mr-1.5" />Import CSV</span>
              </Button>
            </label>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Export
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />New Contact
            </Button>
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
              <th className="py-3 px-4 w-12"></th>
              <th className="py-3 px-4">Company</th>
              <th className="py-3 px-4">Last Called</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts?.map((c) => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-accent/30">
                <td className="py-3 px-4">
                  {c.favorite && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                </td>
                <td className="py-3 px-4 font-medium">
                  {c.name || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-3 px-4 font-mono text-xs">{c.phone}</td>
                <td className="py-3 px-4"><Flag country={c.country} size="sm" /></td>
                <td className="py-3 px-4 text-muted-foreground">{c.company || "—"}</td>
                <td className="py-3 px-4 text-muted-foreground text-xs">
                  {c.lastCalledAt ? formatRelative(c.lastCalledAt) : "—"}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/?dial=${encodeURIComponent(c.phone)}`)}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/messages?to=${encodeURIComponent(c.phone)}`)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {contacts && contacts.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                  No contacts yet. Click "New Contact" or "Import CSV" to add some.
                </td>
              </tr>
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
