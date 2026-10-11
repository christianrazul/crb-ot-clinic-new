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
import type { NotificationItem } from "@/server/services/notifications";

const ICONS: Record<NotificationItem["kind"], LucideIcon> = {
  low_credit: HandCoins,
  notes_overdue: ClipboardList,
  no_shows: CalendarDays,
};

/** Live notifications from the server: low credit, overdue notes, repeat no-shows. */
export function NotificationsMenu({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground"
          aria-label={items.length ? `Notifications, ${items.length} new` : "Notifications"}
        >
          <Bell />
          {items.length > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {items.length > 0 && <Badge variant="secondary">{items.length} new</Badge>}
        </div>
        <div className="p-1">
          {items.length ? (
            items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => router.push(item.href as Route)}
                  className="items-start gap-3 py-2.5"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent">
                    <Icon className="size-3.5! text-accent-foreground!" />
                  </span>
                  <span className="grid flex-1 gap-0.5">
                    <span className="text-[13px] leading-snug font-medium">{item.title}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
