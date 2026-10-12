"use client";

import { CornerDownLeft, HandCoins, Moon, Plus, Sun } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import * as React from "react";

import { useViewer } from "@/components/app/shell/viewer-context";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { usePatientSearch } from "@/components/app/use-patient-search";
import { SERVICE_LABELS } from "@/lib/services";

import { navItemsFor } from "./nav";
import { useShell } from "./shell-context";

/**
 * Every typed word must appear in the item, in any order. Predictable for
 * names: "liam" never matches "Billing & payments" the way fuzzy matching does.
 */
function containsAllWords(value: string, search: string) {
  const haystack = value.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
    ? 1
    : 0;
}

/** Ctrl/Cmd+K palette. Patients come from the demo store until Milestone 5 adds server search. */
export function CommandMenu() {
  const { commandOpen, setCommandOpen } = useShell();
  const viewer = useViewer();
  const [query, setQuery] = React.useState("");
  const { openDialog } = useDialogs();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const isDark = resolvedTheme === "dark";
  const canCollect = viewer.role !== "therapist";
  // Patients come from the server, filtered by the same rules as the patients page.
  const { hits: patients } = usePatientSearch(query, { bookableOnly: false, enabled: commandOpen });

  // Close first, then act, so focus returns cleanly before a dialog or route change.
  const run = (action: () => void) => {
    setCommandOpen(false);
    setTimeout(action, 0);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} filter={containsAllWords}>
      <CommandInput
        placeholder="Search patients, pages, actions…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Patients">
          {patients.map((patient) => {
            const name = `${patient.firstName} ${patient.lastName}`;
            return (
              <CommandItem
                key={patient.id}
                value={`patient ${name} ${patient.guardianName ?? ""}`}
                onSelect={() => run(() => router.push(`/patients?patient=${patient.id}` as Route))}
              >
                <PatientAvatar
                  name={name}
                  service={patient.service}
                  className="size-6 text-[10px]"
                />
                <span className="font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {SERVICE_LABELS[patient.service]}
                </span>
                {patient.status === "inactive" && (
                  <Badge variant="muted" className="ml-auto">
                    Inactive
                  </Badge>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {navItemsFor(viewer.role).map(({ key, label, href, icon: Icon }) => (
            <CommandItem
              key={key}
              value={`page ${label}`}
              onSelect={() => run(() => router.push(href))}
            >
              <Icon className="text-muted-foreground" /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="action new session book"
            onSelect={() => run(() => openDialog({ kind: "booking" }))}
          >
            <Plus className="text-muted-foreground" /> New session
          </CommandItem>
          {canCollect && (
            <CommandItem
              value="action record advance payment credit"
              onSelect={() => run(() => openDialog({ kind: "advance" }))}
            >
              <HandCoins className="text-muted-foreground" /> Record advance payment
            </CommandItem>
          )}
          <CommandItem
            value="action theme dark light mode"
            onSelect={() => run(() => setTheme(isDark ? "light" : "dark"))}
          >
            {isDark ? (
              <Sun className="text-muted-foreground" />
            ) : (
              <Moon className="text-muted-foreground" />
            )}
            Switch to {isDark ? "light" : "dark"} mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" aria-label="Enter" />
          </Kbd>
          to open
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
