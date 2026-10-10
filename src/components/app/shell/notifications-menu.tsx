"use client";

import { Bell, CalendarDays, ClipboardList, HandCoins, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  time: string;
  href: Route;
};

// Static until the notification feed is built (low credit in Milestone 9,
// overdue notes in Milestone 8). Links use ids, never names.
const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    icon: HandCoins,
    title: "Althea Mendoza's credit is low",
    description: "₱700 left. Guardian asked for a reminder under ₱1,000.",
    time: "8:12 AM",
    href: "/patients?patient=pat_05&tab=credit" as Route,
  },
  {
    id: "n2",
    icon: CalendarDays,
    title: "Enzo Dela Peña missed 3 sessions",
    description: "Flagged for a follow-up call this week.",
    time: "Yesterday",
    href: "/patients?patient=pat_03" as Route,
  },
  {
    id: "n3",
    icon: ClipboardList,
    title: "2 session notes are overdue",
    description: "Liam Santos and Althea Mendoza.",
    time: "Yesterday",
    href: "/schedule",
  },
];

export function NotificationsMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground"
          aria-label={`Notifications, ${NOTIFICATIONS.length} new`}
        >
          <Bell />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <Badge variant="secondary">{NOTIFICATIONS.length} new</Badge>
        </div>
        <div className="p-1">
          {NOTIFICATIONS.map(({ id, icon: Icon, title, description, time, href }) => (
            <DropdownMenuItem
              key={id}
              onSelect={() => router.push(href)}
              className="items-start gap-3 py-2.5"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent">
                <Icon className="size-3.5! text-accent-foreground!" />
              </span>
              <span className="grid flex-1 gap-0.5">
                <span className="text-[13px] leading-snug font-medium">{title}</span>
                <span className="text-xs leading-snug text-muted-foreground">{description}</span>
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{time}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
