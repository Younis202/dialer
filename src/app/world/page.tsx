"use client";
import useSWR from "swr";
import { useMemo } from "react";
import { Globe2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { flagEmoji } from "@/lib/phone";
import { formatDuration, formatCurrency } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function WorldPage() {
  const { data: calls } = useSWR<any[]>("/api/calls?limit=500", fetcher, { refreshInterval: 10000 });

  const stats = useMemo(() => {
    const m = new Map<string, { code: string; name: string; calls: number; mins: number; spend: number }>();
    for (const c of calls ?? []) {
      if (!c.countryCode) continue;
      const e = m.get(c.countryCode) ?? { code: c.countryCode, name: c.countryName || c.countryCode, calls: 0, mins: 0, spend: 0 };
      e.calls++; e.mins += (c.duration || 0) / 60; e.spend += c.cost || 0;
      m.set(c.countryCode, e);
    }
    return [...m.values()].sort((a, b) => b.calls - a.calls);
  }, [calls]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="World Map" subtitle="Where in the world your calls go" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <div className="data-card relative overflow-hidden min-h-[500px] flex items-center justify-center">
          <div className="absolute inset-0 grid-pattern opacity-30" />
          <div className="text-center relative">
            <Globe2 className="h-32 w-32 mx-auto text-primary/60" strokeWidth={0.5} />
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-4">
              {stats.length} COUNTRIES REACHED
            </div>
            <div className="font-display text-4xl font-semibold mt-2">
              {stats.reduce((a, b) => a + b.calls, 0)} calls
            </div>
            <div className="flex flex-wrap gap-1 max-w-md mt-6 justify-center">
              {stats.slice(0, 30).map((s) => (
                <span key={s.code} className="text-2xl" title={s.name}>{flagEmoji(s.code)}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="data-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">BY COUNTRY</div>
          <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
            {stats.map((s) => (
              <div key={s.code} className="p-3 flex items-center gap-3">
                <span className="text-2xl">{flagEmoji(s.code)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.calls} calls · {formatDuration(s.mins * 60)} · {formatCurrency(s.spend)}</div>
                </div>
              </div>
            ))}
            {stats.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm">No country data yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
