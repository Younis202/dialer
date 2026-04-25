"use client";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border bg-card/95 backdrop-blur-2xl text-foreground shadow-2xl",
          description: "text-muted-foreground text-xs",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  );
}

export { toast } from "sonner";
