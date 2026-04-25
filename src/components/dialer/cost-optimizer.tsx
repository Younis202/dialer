"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Sparkles } from "lucide-react";
import { getRatesForCountry, type ProviderRate } from "@/lib/rates";
import { cn } from "@/lib/utils";

const LABELS: Record<ProviderRate["provider"], string> = {
  voipms: "Voip.ms",
  twilio: "Twilio",
  telnyx: "Telnyx",
  plivo: "Plivo",
  p2p: "DIALR P2P",
  demo: "Demo",
};

export function CostOptimizer({ country, active = "voipms" }: { country: string; active?: string }) {
  const rates = useMemo(() => getRatesForCountry(country || "US"), [country]);
  const cheapest = rates[0];
  const activeRate = rates.find((r) => r.provider === active) ?? rates[0];
  const savings = activeRate.perMinute - cheapest.perMinute;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Least-Cost Routing
        </div>
        {savings > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-success">
            <TrendingDown className="h-3 w-3" />
            Save ${savings.toFixed(4)}/min
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {rates.slice(0, 4).map((r, i) => {
          const isCheapest = i === 0;
          const isActive = r.provider === active;
          return (
            <motion.div
              key={r.provider}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-1.5 border",
                isCheapest
                  ? "bg-primary/10 border-primary/30"
                  : isActive
                    ? "bg-card/60 border-border"
                    : "bg-card/20 border-border/40"
              )}
            >
              <div className="flex items-center gap-2">
                {isCheapest && <Sparkles className="h-3 w-3 text-primary" />}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCheapest && "text-primary"
                  )}
                >
                  {LABELS[r.provider]}
                </span>
              </div>
              <span className="text-xs font-mono tabular-nums">
                {r.perMinute === 0 ? (
                  <span className="text-success">FREE</span>
                ) : (
                  <>${r.perMinute.toFixed(4)}<span className="text-muted-foreground/60">/min</span></>
                )}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
