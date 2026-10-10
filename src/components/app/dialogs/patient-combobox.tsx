"use client";

import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import * as React from "react";

import { PatientAvatar } from "@/components/app/patient-avatar";
import { usePatientSearch } from "@/components/app/use-patient-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPeso } from "@/lib/money";
import type { ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

export const NEW_PATIENT = "__new";

type Selected = { id: string; name: string; service: ServiceKey } | null;

type PatientComboboxProps = {
  id?: string;
  /** A patient id, NEW_PATIENT, or null. */
  value: string | null;
  /** Shown on the trigger for the selected patient. */
  selected: Selected;
  query: string;
  onQueryChange: (query: string) => void;
  onPick: (patient: { id: string; name: string; service: ServiceKey }) => void;
  onNew?: () => void;
  creditOf?: (patientId: string) => number;
  placeholder?: string;
};

/** Patient picker backed by server search. Only active patients are offered. */
export function PatientCombobox({
  id,
  value,
  selected,
  query,
  onQueryChange,
  onPick,
  onNew,
  creditOf,
  placeholder = "Search patients",
}: PatientComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const { hits, loading } = usePatientSearch(query, { bookableOnly: true, enabled: open });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-3 font-normal"
        >
          {value === NEW_PATIENT ? (
            <span className="flex items-center gap-2">
              <UserPlus className="text-primary" />
              New patient: {query}
            </span>
          ) : selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <PatientAvatar
                name={selected.name}
                service={selected.service}
                className="size-5 text-[9px]"
              />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        {/* The server already filtered; cmdk only handles keyboard focus. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type a name" value={query} onValueChange={onQueryChange} />
          <CommandList className="max-h-[260px]">
            {!loading && <CommandEmpty>No patient matches.</CommandEmpty>}
            {onNew && query.trim() && (
              <CommandGroup>
                <CommandItem
                  value={`__new ${query}`}
                  onSelect={() => {
                    onNew();
                    setOpen(false);
                  }}
                >
                  <UserPlus className="text-primary" /> Add new patient
                  <span className="font-medium">{query.trim()}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {hits.length > 0 && (
              <CommandGroup heading="Patients">
                {hits.map((patient) => {
                  const balance = creditOf?.(patient.id) ?? 0;
                  const name = `${patient.firstName} ${patient.lastName}`;
                  return (
                    <CommandItem
                      key={patient.id}
                      value={patient.id}
                      onSelect={() => {
                        onPick({ id: patient.id, name, service: patient.service });
                        setOpen(false);
                      }}
                    >
                      <PatientAvatar
                        name={name}
                        service={patient.service}
                        className="size-6 text-[10px]"
                      />
                      <span className="grid min-w-0 leading-tight">
                        <span className="truncate font-medium">{name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {patient.guardianName}
                          {patient.guardianRelationship
                            ? `, ${patient.guardianRelationship.toLowerCase()}`
                            : ""}
                        </span>
                      </span>
                      {balance > 0 && (
                        <Badge variant="outline" className="ml-auto border-primary/30 text-primary">
                          {formatPeso(balance)}
                        </Badge>
                      )}
                      {value === patient.id && (
                        <Check className={cn("text-primary", balance > 0 ? "ml-1" : "ml-auto")} />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
