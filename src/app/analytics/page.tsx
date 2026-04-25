"use client";
import useSWR from "swr";
import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/shell/page-header";
import { formatCurrency, formatDuration } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AnalyticsPage() {
  const { data: calls } = useSWR<any[]>("/api/calls?limit=500", fetcher, { refreshInterval: 10000 });

  const { byDay, byCountry, byProvider, totalCalls, totalSpend, totalMinutes, totalConnected } = useMemo(() => {
    const cs = calls ?? [];
    const dayMap = new Map<string, { day: string; calls: number; cost: number; mins: number }>();
    const countryMap = new Map<string, number>();
    const providerMap = new Map<string, number>();
    let totalSpend = 0, totalMinutes = 0, totalConnected = 0;

    for (const c of cs) {
      const day = new Date(c.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const e = dayMap.get(day) ?? { day, calls: 0, cost: 0, mins: 0 };
      e.calls++; e.cost += c.cost || 0; e.mins += (c.duration || 0) / 60;
      dayMap.set(day, e);

      const cn = c.countryName || c.countryCode || "Unknown";
      countryMap.set(cn, (countryMap.get(cn) || 0) + 1);
      providerMap.set(c.provider || "demo", (providerMap.get(c.provider || "demo") || 0) + 1);

      totalSpend += c.cost || 0;
      totalMinutes += c.duration || 0;
      if ((c.duration || 0) > 0) totalConnected++;
    }

    return {
      byDay: [...dayMap.values()].slice(-30),
      byCountry: [...countryMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      byProvider: [...providerMap.entries()].map(([name, value]) => ({ name, value })),
      totalCalls: cs.length,
      totalSpend, totalMinutes, totalConnected,
    };
  }, [calls]);

  const COLORS = ["#10e6a5", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#ec4899"];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Analytics" subtitle="Performance, cost, and reach across all your calls" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Calls" value={totalCalls} />
        <Stat label="Connected" value={totalConnected} />
        <Stat label="Talk Time" value={formatDuration(totalMinutes)} />
        <Stat label="Spend" value={formatCurrency(totalSpend)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="data-card">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">CALLS PER DAY</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={byDay}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10e6a5" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10e6a5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="day" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
              <Area type="monotone" dataKey="calls" stroke="#10e6a5" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="data-card">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">SPEND PER DAY ($)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="day" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
              <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="data-card">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">TOP COUNTRIES</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCountry} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis type="number" stroke="#666" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#666" fontSize={10} width={100} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#10e6a5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="data-card">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">PROVIDER MIX</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byProvider} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {byProvider.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {byProvider.map((p, i) => (
              <span key={p.name} className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="data-card !p-4">
      <div className="stat-label">{label}</div>
      <div className="stat-num mt-1">{value}</div>
    </div>
  );
}
