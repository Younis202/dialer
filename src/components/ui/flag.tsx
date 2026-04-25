"use client";
import { cn } from "@/lib/utils";

const SIZE_MAP = { xs: "h-3 w-4", sm: "h-3.5 w-5", md: "h-4 w-6", lg: "h-5 w-7", xl: "h-6 w-9" } as const;

export function Flag({
  country,
  size = "md",
  className,
}: {
  country?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}) {
  const cc = (country || "").toLowerCase().trim();
  if (!cc || cc.length !== 2) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-sm bg-muted/40 text-[8px] font-mono text-muted-foreground/60",
          SIZE_MAP[size],
          className
        )}
        aria-hidden
      >
        ··
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-sm ring-1 ring-border/60",
        SIZE_MAP[size],
        className
      )}
      style={{
        backgroundImage: `url(https://flagcdn.com/${cc}.svg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-label={cc.toUpperCase()}
      role="img"
    />
  );
}

export function CountryChip({ country, name }: { country?: string | null; name?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag country={country} size="sm" />
      {name && <span className="text-xs text-muted-foreground">{name}</span>}
    </span>
  );
}
