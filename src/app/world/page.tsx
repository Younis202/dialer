"use client";
import useSWR from "swr";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/shell/page-header";
import { Flag } from "@/components/ui/flag";
import { formatDuration, formatCurrency } from "@/lib/utils";

const WorldMap = dynamic(() => import("@/components/world-map").then((m) => m.WorldMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-xs font-mono text-muted-foreground">
      Loading map…
    </div>
  ),
});

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function WorldPage() {
  const { data: calls } = useSWR<any[]>("/api/calls?limit=500", fetcher, { refreshInterval: 15000 });
  const [hovered, setHovered] = useState<string | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { code: string; name: string; calls: number; mins: number; spend: number }>();
    for (const c of calls ?? []) {
      if (!c.countryCode) continue;
      const cc = String(c.countryCode).toUpperCase();
      const e = m.get(cc) ?? { code: cc, name: c.countryName || cc, calls: 0, mins: 0, spend: 0 };
      e.calls++;
      e.mins += (c.duration || 0) / 60;
      e.spend += c.cost || 0;
      m.set(cc, e);
    }
    return [...m.values()].sort((a, b) => b.calls - a.calls);
  }, [calls]);

  const intensityByCode = useMemo(() => {
    const out: Record<string, number> = {};
    const max = Math.max(1, ...stats.map((s) => s.calls));
    for (const s of stats) out[s.code] = s.calls / max;
    return out;
  }, [stats]);

  const totalCalls = stats.reduce((a, b) => a + b.calls, 0);
  const hoveredEntry = hovered ? stats.find((s) => s.code === hovered) : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="World Map" subtitle="Where in the world your calls go" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <div className="data-card relative overflow-hidden min-h-[520px]">
          <div className="absolute top-4 left-4 z-10 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              {stats.length} COUNTRIES · {totalCalls} CALLS
            </div>
            {hoveredEntry && (
              <div className="surface px-3 py-2 inline-flex items-center gap-2">
                <Flag country={hoveredEntry.code} size="md" />
                <div>
                  <div className="text-sm font-medium">{hoveredEntry.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {hoveredEntry.calls} calls · {formatDuration(hoveredEntry.mins * 60)} · {formatCurrency(hoveredEntry.spend)}
                  </div>
                </div>
              </div>
            )}
          </div>
          <WorldMap intensity={intensityByCode} onHover={setHovered} />
        </div>

        <div className="data-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            BY COUNTRY
          </div>
          <div className="divide-y divide-border/30 max-h-[520px] overflow-y-auto">
            {stats.map((s) => (
              <div
                key={s.code}
                className="p-3 flex items-center gap-3 hover:bg-accent/30 transition-colors"
                onMouseEnter={() => setHovered(s.code)}
                onMouseLeave={() => setHovered(null)}
              >
                <Flag country={s.code} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {s.calls} calls · {formatDuration(s.mins * 60)} · {formatCurrency(s.spend)}
                  </div>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {s.calls}
                </span>
              </div>
            ))}
            {stats.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">No country data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
