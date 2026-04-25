"use client";
import { useRouter } from "next/navigation";
import { Phone, Users, History, MessageSquare, Settings, Network, Globe2, BarChart3, Zap, ListOrdered, Calendar, FileText, Mic, Ban } from "lucide-react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const go = (path: string) => {
    onOpenChange(false);
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, search a contact, dial a number…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
