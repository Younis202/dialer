"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Phone, Zap, Globe2, Map, Users, ListOrdered, History, MessageSquare,
  Calendar, FileText, Mic, BarChart3, Ban, Settings, Network, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    section: "Dial",
    items: [
      { href: "/", label: "Dialer", icon: Phone },
      { href: "/power", label: "Power Dialer", icon: Zap },
      { href: "/network", label: "DIALR Network", icon: Network },
      { href: "/world", label: "World Map", icon: Globe2 },
    ],
  },
  {
    section: "Data",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/lists", label: "Lists", icon: ListOrdered },
      { href: "/history", label: "History", icon: History },
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
    ],
  },
  {
    section: "Safety",
    items: [
      { href: "/dnc", label: "DNC List", icon: Ban },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-border/40 bg-card/20 backdrop-blur-2xl">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]">
          <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          <motion.span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div>
          <div className="font-display text-base font-semibold tracking-tight">DIALR</div>
          <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            World Dialer · v2
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
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
                  <Link key={it.href} href={it.href} className={cn("nav-link", active && "active")}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border/40 px-4 py-4">
        <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
          My Number
        </div>
        <div className="font-mono text-sm mt-1">+1 (669) 222-2638</div>
        <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          DEMO MODE
        </div>
      </div>
    </aside>
  );
}
