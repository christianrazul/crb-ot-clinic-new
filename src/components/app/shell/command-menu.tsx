"use client";

import { CornerDownLeft, HandCoins, Moon, Plus, Sun } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";

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
import { PATIENTS } from "@/lib/fixtures/patients";
import type { Role } from "@/lib/roles";
import { SERVICE_LABELS } from "@/lib/services";

import { openNewSession } from "./app-header";
import { navItemsFor } from "./nav";
import { useShell } from "./shell-context";

/** Ctrl/Cmd+K palette. Patients are static fixtures until Milestone 5 adds server search. */
export function CommandMenu({ role }: { role: Role }) {
  const { commandOpen, setCommandOpen } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const isDark = resolvedTheme === "dark";
  const canBook = role !== "therapist";

  // Close first, then act, so focus returns cleanly before a dialog or route change.
  const run = (action: () => void) => {
    setCommandOpen(false);
    setTimeout(action, 0);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search patients, pages, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Patients">
          {PATIENTS.map((patient) => (
            <CommandItem
              key={patient.id}
              value={`patient ${patient.name} ${patient.guardian}`}
              onSelect={() => run(() => router.push(`/patients?patient=${patient.id}` as Route))}
            >
              <PatientAvatar
                name={patient.name}
                service={patient.service}
                className="size-6 text-[10px]"
              />
              <span className="font-medium">{patient.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {SERVICE_LABELS[patient.service]}
              </span>
              {!patient.active && (
                <Badge variant="muted" className="ml-auto">
                  Inactive
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {navItemsFor(role).map(({ key, label, href, icon: Icon }) => (
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
          {canBook && (
            <CommandItem value="action new session book" onSelect={() => run(openNewSession)}>
              <Plus className="text-muted-foreground" /> New session
            </CommandItem>
          )}
          {canBook && (
            <CommandItem
              value="action record advance payment credit"
              onSelect={() =>
                run(() =>
                  toast.info("Advance payments are not built yet", {
                    description: "They arrive in Milestone 2.",
                  }),
                )
              }
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
