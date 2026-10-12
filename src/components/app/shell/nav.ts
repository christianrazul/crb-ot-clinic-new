import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import type { Route } from "next";

import type { Role } from "@/lib/roles";

export type ScreenKey =
  "dashboard" | "today" | "my-day" | "schedule" | "patients" | "billing" | "payroll" | "settings";

export type NavItem = { key: ScreenKey; label: string; href: Route; icon: LucideIcon };
export type NavSection = { heading: string; items: NavItem[] };

const item = (key: ScreenKey, label: string, icon: LucideIcon): NavItem => ({
  key,
  label,
  href: `/${key}` as Route,
  icon,
});

/** Sidebar navigation per role, grouped as in the mockup. */
export const NAV: Record<Role, NavSection[]> = {
  superadmin: [
    { heading: "", items: [item("dashboard", "Dashboard", LayoutDashboard)] },
    {
      heading: "Clinic",
      items: [item("schedule", "Schedule", CalendarDays), item("patients", "Patients", Users)],
    },
    {
      heading: "Finance",
      items: [
        item("billing", "Billing & payments", CreditCard),
        item("payroll", "Payroll", Wallet),
      ],
    },
    { heading: "Admin", items: [item("settings", "Settings", Settings)] },
  ],
  secretary: [
    { heading: "", items: [item("today", "Today", CalendarCheck)] },
    {
      heading: "Clinic",
      items: [item("schedule", "Schedule", CalendarDays), item("patients", "Patients", Users)],
    },
    { heading: "Finance", items: [item("billing", "Billing & payments", CreditCard)] },
  ],
  therapist: [
    { heading: "", items: [item("my-day", "My day", ClipboardList)] },
    {
      heading: "Clinic",
      items: [item("schedule", "My schedule", CalendarDays), item("patients", "Patients", Users)],
    },
  ],
};

export const ROLE_HOME: Record<Role, Route> = {
  superadmin: "/dashboard",
  secretary: "/today",
  therapist: "/my-day",
};

/** Page titles for the header breadcrumb. */
export const SCREEN_TITLES: Record<ScreenKey, string> = {
  dashboard: "Dashboard",
  today: "Today",
  "my-day": "My day",
  schedule: "Schedule",
  patients: "Patients",
  billing: "Billing & payments",
  payroll: "Payroll",
  settings: "Settings",
};

/** Screens where the header shows the "New session" button. */
export const SCREENS_WITH_NEW_SESSION: ScreenKey[] = ["dashboard", "today", "my-day", "schedule"];

export function navItemsFor(role: Role): NavItem[] {
  return NAV[role].flatMap((section) => section.items);
}

export function canSeeScreen(role: Role, screen: ScreenKey): boolean {
  return navItemsFor(role).some((navItem) => navItem.key === screen);
}

export function screenFromPathname(pathname: string): ScreenKey | null {
  const segment = pathname.split("/")[1] ?? "";
  return segment in SCREEN_TITLES ? (segment as ScreenKey) : null;
}
