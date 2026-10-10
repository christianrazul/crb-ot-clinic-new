"use client";

import {
  Building2,
  Clock3,
  Layers,
  type LucideIcon,
  Percent,
  UserRound,
  Users,
} from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Page, PageHeader } from "@/components/app/page-layout";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import { BranchesSection } from "./branches-section";
import { HoursSection } from "./hours-section";
import { PatientsSection } from "./patients-section";
import { RatesSection } from "./rates-section";
import { SessionTypesSection } from "./session-types-section";
import { StaffSection } from "./staff-section";

const SECTIONS: {
  key: string;
  label: string;
  icon: LucideIcon;
  Body: (props: { data: SettingsPageData }) => React.ReactNode;
}[] = [
  { key: "rates", label: "Rates and splits", icon: Percent, Body: RatesSection },
  { key: "sessions", label: "Session types", icon: Layers, Body: SessionTypesSection },
  { key: "staff", label: "Staff", icon: Users, Body: StaffSection },
  { key: "patients", label: "Patients", icon: UserRound, Body: PatientsSection },
  { key: "branches", label: "Branches", icon: Building2, Body: BranchesSection },
  { key: "hours", label: "Operating hours", icon: Clock3, Body: HoursSection },
];

export function SettingsScreen({ data }: { data: SettingsPageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = SECTIONS.find((s) => s.key === params.get("tab")) ?? SECTIONS[0]!;

  return (
    <Page>
      <PageHeader title="Settings" description="Clinic-wide rates, people and locations." />
      <Separator />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav
          aria-label="Settings sections"
          className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:w-52 lg:shrink-0 lg:flex-col"
        >
          {SECTIONS.map(({ key, label, icon: Icon }) => {
            const current = key === active.key;
            return (
              <button
                key={key}
                aria-current={current ? "page" : undefined}
                onClick={() => router.replace(`${pathname}?tab=${key}` as Route, { scroll: false })}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  current
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", current && "text-primary")} aria-hidden />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1 lg:max-w-4xl">
          <active.Body data={data} />
        </div>
      </div>
    </Page>
  );
}
