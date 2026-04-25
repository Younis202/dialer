"use client";
import { useEffect, useState } from "react";
import { Search, Bell, Sparkles, Command as CommandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandPalette } from "./command-palette";

export function Header() {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
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

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/40 bg-background/60 backdrop-blur-xl px-6 py-3">
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 px-3.5 py-1.5 text-sm text-muted-foreground hover:bg-card/60 hover:border-border transition-all min-w-[280px]"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search contacts, calls, anywhere…</span>
          <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono">
            <CommandIcon className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse mr-1.5" />
            DEMO
          </Badge>
          <span className="text-xs font-mono text-muted-foreground">{time}</span>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
          </Button>
          <Button variant="ghost" size="icon" className="bg-gradient-to-br from-primary/20 to-info/20 border border-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </Button>
        </div>
      </header>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
