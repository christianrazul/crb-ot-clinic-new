"use client";

import {
  Building2,
  Clock3,
  Layers,
  type LucideIcon,
  Percent,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Page, PageHeader } from "@/components/app/page-layout";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import { AuditSection } from "./audit-section";
import { BranchesSection } from "./branches-section";
import { HoursSection } from "./hours-section";
import { PatientsSection } from "./patients-section";
import { RatesSection } from "./rates-section";
import { SessionTypesSection } from "./session-types-section";
import { StaffSection } from "./staff-section";
import { TeamSection } from "./team-section";

const SECTIONS: {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Branch settings apply to the branch picked in the sidebar; clinic settings to all. */
  scope: "branch" | "clinic";
  Body: (props: { data: SettingsPageData }) => React.ReactNode;
}[] = [
  { key: "rates", label: "Rates and splits", icon: Percent, scope: "branch", Body: RatesSection },
  {
    key: "sessions",
    label: "Session types",
    icon: Layers,
    scope: "branch",
    Body: SessionTypesSection,
  },
  { key: "staff", label: "Staff", icon: Users, scope: "branch", Body: StaffSection },
  { key: "team", label: "Team accounts", icon: ShieldCheck, scope: "clinic", Body: TeamSection },
  { key: "patients", label: "Patients", icon: UserRound, scope: "branch", Body: PatientsSection },
  { key: "branches", label: "Branches", icon: Building2, scope: "clinic", Body: BranchesSection },
  { key: "hours", label: "Operating hours", icon: Clock3, scope: "branch", Body: HoursSection },
  { key: "audit", label: "Audit log", icon: ScrollText, scope: "clinic", Body: AuditSection },
];

export function SettingsScreen({ data }: { data: SettingsPageData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = SECTIONS.find((s) => s.key === params.get("tab")) ?? SECTIONS[0]!;

  return (
    <Page>
      <PageHeader
        title="Settings"
        description={
          active.scope === "branch"
            ? `For ${data.branch.name}. Switch branch in the sidebar to change another branch.`
            : "For the whole clinic, across every branch."
        }
      />
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
          {/* Remount on branch switch, so no form keeps another branch's values. */}
          <active.Body key={data.branch.id} data={data} />
        </div>
      </div>
    </Page>
  );
}
