"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  Phone, Users, History, MessageSquare, Settings, Network, Globe2,
  BarChart3, Zap, ListOrdered, Calendar, FileText, Mic, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSip } from "./sip-provider";
import { useP2P } from "./p2p-provider";

const NAV: { section: string; items: { href: string; label: string; icon: any; hint?: string }[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/", label: "Dialer", icon: Phone },
      { href: "/power", label: "Power Dialer", icon: Zap },
      { href: "/network", label: "DIALR Network", icon: Network },
      { href: "/world", label: "World Map", icon: Globe2 },
    ],
  },
  {
    section: "CRM",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/lists", label: "Lists", icon: ListOrdered },
      { href: "/history", label: "Call History", icon: History },
      { href: "/messages", label: "Messages", icon: MessageSquare },
      { href: "/scheduled", label: "Scheduled", icon: Calendar },
    ],
  },
  {
    section: "Tools",
    items: [
      { href: "/scripts", label: "Scripts", icon: FileText },
      { href: "/voicemail", label: "Voicemail Drop", icon: Mic },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dnc", label: "DNC List", icon: Ban },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function Sidebar() {
  const pathname = usePathname();
  const { registered, state: sipState, config } = useSip();
  const { myHandle } = useP2P();
  const { data: settings } = useSWR<any>("/api/settings", fetcher);
  const myNumber = settings?.myNumber || config?.uri?.split("@")?.[0]?.replace("sip:", "") || "";

  return (
    <aside className="hidden md:flex h-screen w-60 shrink-0 flex-col border-r border-border/40 bg-card/30">
      <Link href="/" prefetch={false} className="flex items-center gap-2.5 px-5 py-5">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]">
          <Phone className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display text-base font-semibold tracking-tight leading-none">DIALR</div>
          <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground mt-1">
            World Dialer
          </div>
        </div>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {NAV.map((sec) => (
          <div key={sec.section}>
            <div className="px-3 mb-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
              {sec.section}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((it) => {
                const active = pathname === it.href;
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    prefetch={false}
                    className={cn("nav-link relative", active && "active")}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border/40 px-4 py-3 space-y-2">
        <StatusRow
          dot={registered ? "success" : sipState === "registering" ? "warning" : "muted"}
          label="SIP"
          value={
            registered
              ? "Registered"
              : sipState === "registering"
                ? "Connecting…"
                : sipState === "failed"
                  ? "Failed"
                  : "Not configured"
          }
        />
        <StatusRow
          dot={myHandle ? "success" : "muted"}
          label="Network"
          value={myHandle || "Connecting…"}
          mono
        />
        {myNumber && (
          <div className="pt-2 mt-2 border-t border-border/40">
            <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
              My Number
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-0.5 truncate">{myNumber}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function StatusRow({
  dot,
  label,
  value,
  mono,
}: {
  dot: "success" | "warning" | "muted";
  label: string;
  value: string;
  mono?: boolean;
}) {
  const color =
    dot === "success" ? "bg-success" : dot === "warning" ? "bg-warning" : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", color, dot === "success" && "pulse-dot")} />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
          {label}
        </div>
        <div className={cn("text-[11px] truncate", mono && "font-mono")}>{value}</div>
      </div>
    </div>
  );
}
