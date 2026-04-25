"use client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { P2PProvider } from "./p2p-provider";
import { SipProvider } from "./sip-provider";
import { SWRConfig } from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 4000,
        shouldRetryOnError: false,
      }}
    >
      <TooltipProvider delayDuration={300}>
        <SipProvider>
          <P2PProvider>{children}</P2PProvider>
        </SipProvider>
        <Toaster />
      </TooltipProvider>
    </SWRConfig>
  );
}
