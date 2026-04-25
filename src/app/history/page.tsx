"use client";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Phone, Download, ArrowDownLeft, ArrowUpRight, Trash2, MessageSquare, Tag,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flag } from "@/components/ui/flag";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration, formatRelative, formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { parsePhone } from "@/lib/phone";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function HistoryPage() {
  const router = useRouter();
  const { data, mutate } = useSWR<any[]>("/api/calls?limit=200", fetcher, { refreshInterval: 8000 });
  const { data: dispositions } = useSWR<any[]>("/api/dispositions", fetcher);
  const [active, setActive] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [dispositionId, setDispositionId] = useState<string>("");

  function exportCsv() {
    if (!data?.length) return;
    const header = "started_at,direction,to_number,country,duration_sec,cost,provider,status,notes";
    const rows = data.map((c) =>
      [new Date(c.startedAt).toISOString(), c.direction, c.toNumber, c.countryCode, c.duration, c.cost, c.provider, c.status, `"${(c.notes || "").replace(/"/g, '""')}"`].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dialr-history.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: number) {
    await fetch(`/api/calls/${id}`, { method: "DELETE" });
    mutate();
    toast.success("Call deleted");
  }

  function open(c: any) {
    setActive(c);
    setNotes(c.notes || "");
    setDispositionId(c.dispositionId ? String(c.dispositionId) : "");
  }

  async function saveDisposition() {
    if (!active) return;
    await fetch(`/api/calls/${active.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes,
        dispositionId: dispositionId ? parseInt(dispositionId, 10) : null,
      }),
    });
    toast.success("Saved");
    mutate();
    setActive(null);
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Call History"
        subtitle={`${data?.length ?? 0} recent calls`}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
        }
      />

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-3 px-4">When</th>
              <th className="py-3 px-4 w-12"></th>
              <th className="py-3 px-4">Number</th>
              <th className="py-3 px-4">Country</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Cost</th>
              <th className="py-3 px-4">Provider</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr
                key={c.id}
                className="border-b border-border/30 hover:bg-accent/30 cursor-pointer"
                onClick={() => open(c)}
              >
                <td className="py-3 px-4 text-muted-foreground text-xs">{formatRelative(c.startedAt)}</td>
                <td className="py-3 px-4">
                  {c.direction === "inbound" ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-info" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-xs">{c.toNumber}</td>
                <td className="py-3 px-4">
                  {c.countryCode ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Flag country={c.countryCode} size="sm" />
                      <span className="text-xs text-muted-foreground">{c.countryName}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4 font-mono">{formatDuration(c.duration || 0)}</td>
                <td className="py-3 px-4 font-mono">{formatCurrency(c.cost || 0)}</td>
                <td className="py-3 px-4">
                  <Badge variant="outline" className="font-mono text-[10px]">{c.provider}</Badge>
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant={c.status === "ended" || c.status === "in_call" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {c.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/?dial=${encodeURIComponent(c.toNumber)}`)}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground">
                  No calls yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Flag country={active?.countryCode} size="md" />
              <span className="font-mono">{active?.toNumber}</span>
            </SheetTitle>
          </SheetHeader>
          {active && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Duration" value={formatDuration(active.duration || 0)} />
                <Stat label="Cost" value={formatCurrency(active.cost || 0)} />
                <Stat label="Provider" value={active.provider} />
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(active.startedAt).toLocaleString()}
                {active.countryName && ` · ${active.countryName}`}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Disposition
                </Label>
                <Select value={dispositionId} onValueChange={setDispositionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tag this call…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(dispositions ?? []).map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: d.color }}
                          />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/?dial=${encodeURIComponent(active.toNumber)}`)}
                >
                  <Phone className="h-3.5 w-3.5 mr-1.5" />Call back
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/messages?to=${encodeURIComponent(active.toNumber)}`)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Message
                </Button>
              </div>
              <Button onClick={saveDisposition} className="w-full">Save</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm mt-1 truncate">{value}</div>
    </div>
  );
}
