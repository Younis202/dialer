"use client";
import useSWR from "swr";
import { Phone, Download, ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatRelative, formatCurrency } from "@/lib/utils";
import { flagEmoji } from "@/lib/phone";
import { toast } from "@/components/ui/sonner";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function HistoryPage() {
  const { data, mutate } = useSWR<any[]>("/api/calls?limit=200", fetcher, { refreshInterval: 5000 });

  function exportCsv() {
    if (!data?.length) return;
    const header = "started_at,direction,to_number,country,duration_sec,cost,provider,status";
    const rows = data.map((c) => [new Date(c.startedAt).toISOString(), c.direction, c.toNumber, c.countryCode, c.duration, c.cost, c.provider, c.status].join(","));
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

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Call History"
        subtitle={`${data?.length ?? 0} recent calls`}
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" />Export CSV</Button>}
      />

      <div className="data-card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-3 px-4">When</th>
              <th className="py-3 px-4">Direction</th>
              <th className="py-3 px-4">Number</th>
              <th className="py-3 px-4">Country</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Cost</th>
              <th className="py-3 px-4">Provider</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-accent/30">
                <td className="py-3 px-4 text-muted-foreground">{formatRelative(c.startedAt)}</td>
                <td className="py-3 px-4">{c.direction === "inbound" ? <ArrowDownLeft className="h-3.5 w-3.5 text-info" /> : <ArrowUpRight className="h-3.5 w-3.5 text-success" />}</td>
                <td className="py-3 px-4 font-mono text-xs">{c.toNumber}</td>
                <td className="py-3 px-4">{c.countryCode ? <span>{flagEmoji(c.countryCode)} <span className="text-xs text-muted-foreground">{c.countryName}</span></span> : "—"}</td>
                <td className="py-3 px-4 font-mono">{formatDuration(c.duration || 0)}</td>
                <td className="py-3 px-4 font-mono">{formatCurrency(c.cost || 0)}</td>
                <td className="py-3 px-4"><Badge variant="outline" className="font-mono">{c.provider}</Badge></td>
                <td className="py-3 px-4"><Badge variant={c.status === "ended" ? "default" : "outline"}>{c.status}</Badge></td>
                <td className="py-3 px-4 text-right"><Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">No calls yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
