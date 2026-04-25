"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Settings, Command as CommandIcon, Phone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "./command-palette";
import { useSip } from "./sip-provider";
import { useP2P } from "./p2p-provider";
import { cn } from "@/lib/utils";

export function Header() {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const { registered, state: sipState } = useSip();
  const { peers, myHandle } = useP2P();

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const peerCount = peers.filter((p) => p !== myHandle).length;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-md px-5 py-2.5">
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-card/60 hover:border-border transition-colors min-w-[260px] max-w-md w-full"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">Search or dial — type a number, name, command…</span>
          <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono">
            <CommandIcon className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2.5">
          <StatusPill
            icon={Phone}
            color={registered ? "text-success" : sipState === "registering" ? "text-warning" : "text-muted-foreground"}
            label={registered ? "SIP" : sipState === "registering" ? "SIP…" : "SIP off"}
          />
          <StatusPill
            icon={Wifi}
            color={myHandle ? "text-success" : "text-muted-foreground"}
            label={myHandle ? `${peerCount} peer${peerCount === 1 ? "" : "s"}` : "Offline"}
          />
          <span className="hidden sm:inline text-xs font-mono text-muted-foreground tabular-nums">{time}</span>
          <Link href="/settings" prefetch={false}>
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

function StatusPill({
  icon: Icon,
  color,
  label,
}: {
  icon: any;
  color: string;
  label: string;
}) {
  return (
    <div className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/30 px-2.5 py-1">
      <Icon className={cn("h-3 w-3", color)} strokeWidth={2.2} />
      <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
    </div>
  );
}
