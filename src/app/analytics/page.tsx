"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { TrendingUp, Phone, Clock, DollarSign, Globe2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Flag } from "@/components/ui/flag";
import { formatCurrency, formatDuration } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export default function AnalyticsPage() {
  const { data: calls } = useSWR<any[]>("/api/calls?limit=1000", fetcher, { refreshInterval: 30000 });
  const { data: dispositions } = useSWR<any[]>("/api/dispositions", fetcher);

  const stats = useMemo(() => {
    if (!calls) return null;
    const now = new Date();
    const days: { day: string; count: number; mins: number; cost: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = startOfDay(d);
      const end = start + 86400000;
      const subset = calls.filter((c) => c.startedAt >= start && c.startedAt < end);
      days.push({
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: subset.length,
        mins: subset.reduce((a, c) => a + (c.duration || 0), 0) / 60,
        cost: subset.reduce((a, c) => a + (c.cost || 0), 0),
      });
    }
    const totalCalls = calls.length;
    const totalMins = calls.reduce((a, c) => a + (c.duration || 0), 0) / 60;
    const totalSpend = calls.reduce((a, c) => a + (c.cost || 0), 0);
    const avgDur = totalCalls ? totalMins / totalCalls : 0;
    const connected = calls.filter((c) => (c.duration || 0) > 5).length;
    const connectRate = totalCalls ? (connected / totalCalls) * 100 : 0;

    const countryStats = new Map<string, { code: string; name: string; calls: number }>();
    for (const c of calls) {
      if (!c.countryCode) continue;
      const cc = String(c.countryCode).toUpperCase();
      const e = countryStats.get(cc) || { code: cc, name: c.countryName || cc, calls: 0 };
      e.calls++;
      countryStats.set(cc, e);
    }

    const dispMap = new Map<number, number>();
    for (const c of calls) if (c.dispositionId) dispMap.set(c.dispositionId, (dispMap.get(c.dispositionId) || 0) + 1);
    const dispositionStats = (dispositions ?? []).map((d) => ({ ...d, count: dispMap.get(d.id) || 0 })).sort((a, b) => b.count - a.count);

    return { days, totalCalls, totalMins, totalSpend, avgDur, connectRate, topCountries: [...countryStats.values()].sort((a, b) => b.calls - a.calls).slice(0, 8), dispositionStats };
  }, [calls, dispositions]);

  const maxCount = Math.max(1, ...(stats?.days.map((d) => d.count) ?? [1]));
  const maxDispCount = Math.max(1, ...(stats?.dispositionStats.map((d) => d.count) ?? [1]));

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Analytics" subtitle="Last 14 days" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={Phone} label="Total Calls" value={stats?.totalCalls ?? 0} />
        <Stat icon={Clock} label="Talk Time" value={formatDuration((stats?.totalMins ?? 0) * 60)} />
        <Stat icon={DollarSign} label="Total Spend" value={formatCurrency(stats?.totalSpend ?? 0)} />
        <Stat icon={TrendingUp} label="Connect Rate" value={`${(stats?.connectRate ?? 0).toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="data-card lg:col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-4">
            CALLS PER DAY
          </div>
          <div className="flex items-end gap-2 h-56">
            {stats?.days.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group">
                <div className="text-[10px] font-mono text-muted-foreground tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.count}
                </div>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary transition-all hover:from-primary hover:to-success"
                    style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: "2px" }}
                  />
                </div>
                <div className="text-[9px] font-mono text-muted-foreground truncate w-full text-center">
                  {d.day}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="data-card">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-4">
            TOP COUNTRIES
          </div>
          <div className="space-y-2.5">
            {stats?.topCountries.map((c) => (
              <div key={c.code} className="flex items-center gap-3">
                <Flag country={c.code} size="md" />
                <div className="flex-1 text-sm truncate">{c.name}</div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.calls}</span>
              </div>
            ))}
            {stats?.topCountries.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">
                <Globe2 className="h-8 w-8 mx-auto opacity-30 mb-2" />
                No data yet
              </div>
            )}
          </div>
        </div>

        <div className="data-card lg:col-span-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-4">
            DISPOSITIONS
          </div>
          <div className="space-y-2">
            {stats?.dispositionStats.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <div className="text-sm font-medium w-32">{d.name}</div>
                <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(d.count / maxDispCount) * 100}%`, background: d.color }}
                  />
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground w-10 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="data-card !p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-semibold mt-0.5 tabular-nums truncate">{value}</div>
      </div>
    </div>
  );
}
