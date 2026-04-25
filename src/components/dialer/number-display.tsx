"use client";
import { Delete } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ParsedPhone } from "@/lib/phone";
import { Flag } from "@/components/ui/flag";
import { cn } from "@/lib/utils";

export function NumberDisplay({
  raw,
  parsed,
  onChange,
  onBackspace,
}: {
  raw: string;
  parsed: ParsedPhone;
  onChange: (v: string) => void;
  onBackspace: () => void;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2 mb-2 px-1 min-h-[20px]">
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {parsed.country && (
              <motion.div
                key={parsed.country}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-1.5"
              >
                <Flag country={parsed.country} size="sm" />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  {parsed.countryName}
                </span>
                {parsed.type !== "unknown" && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                    · {parsed.type}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          {parsed.isValid ? <span className="text-success">Valid</span> : <span>Destination</span>}
        </div>
      </div>

      <div className="relative group">
        <input
          type="tel"
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+1 555 123 4567"
          className={cn(
            "w-full bg-transparent border-0 outline-none",
            "font-display font-medium tabular-nums",
            "text-3xl md:text-4xl tracking-tight text-center",
            "py-3 placeholder:text-muted-foreground/30",
            "transition-colors"
          )}
        />
        {raw && (
          <button
            onClick={onBackspace}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            aria-label="Backspace"
          >
            <Delete className="h-4 w-4" />
          </button>
        )}
        <div className="absolute inset-x-8 -bottom-px h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </div>
  );
}
