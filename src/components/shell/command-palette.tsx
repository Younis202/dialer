"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Phone, Users, History, MessageSquare, Settings, Network, Globe2,
  BarChart3, Zap, ListOrdered, Calendar, FileText, Mic, Ban, Search,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Flag } from "@/components/ui/flag";
import { parsePhone } from "@/lib/phone";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data: contacts } = useSWR<any[]>(open && q.length >= 2 ? `/api/contacts?q=${encodeURIComponent(q)}` : null, fetcher);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const go = (path: string) => { onOpenChange(false); router.push(path); };
  const dial = (phone: string) => { onOpenChange(false); router.push(`/?dial=${encodeURIComponent(phone)}`); };

  const parsed = parsePhone(q);
  const showDial = parsed.isValid;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search or dial — type a number, name, command…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {showDial && (
          <CommandGroup heading="Action">
            <CommandItem onSelect={() => dial(parsed.e164)} value={`dial-${parsed.e164}`}>
              <Phone />
              <span>Dial</span>
              <Flag country={parsed.country} size="sm" />
              <span className="font-mono text-xs">{parsed.international}</span>
              <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {parsed.countryName}
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {contacts && contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {contacts.slice(0, 8).map((c) => (
              <CommandItem key={c.id} onSelect={() => dial(c.phone)} value={`contact-${c.id}-${c.name}-${c.phone}`}>
                <Search />
                <span>{c.name || c.phone}</span>
                {c.company && <span className="text-xs text-muted-foreground">· {c.company}</span>}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}><Phone />Open Dialer</CommandItem>
          <CommandItem onSelect={() => go("/power")}><Zap />Power Dialer</CommandItem>
          <CommandItem onSelect={() => go("/network")}><Network />DIALR Network</CommandItem>
          <CommandItem onSelect={() => go("/world")}><Globe2 />World Map</CommandItem>
          <CommandItem onSelect={() => go("/contacts")}><Users />Contacts</CommandItem>
          <CommandItem onSelect={() => go("/lists")}><ListOrdered />Lists</CommandItem>
          <CommandItem onSelect={() => go("/history")}><History />Call History</CommandItem>
          <CommandItem onSelect={() => go("/messages")}><MessageSquare />Messages</CommandItem>
          <CommandItem onSelect={() => go("/scheduled")}><Calendar />Scheduled</CommandItem>
          <CommandItem onSelect={() => go("/scripts")}><FileText />Scripts</CommandItem>
          <CommandItem onSelect={() => go("/voicemail")}><Mic />Voicemail Drop</CommandItem>
          <CommandItem onSelect={() => go("/analytics")}><BarChart3 />Analytics</CommandItem>
          <CommandItem onSelect={() => go("/dnc")}><Ban />DNC List</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings />Settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
