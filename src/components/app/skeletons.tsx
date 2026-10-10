import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { Page } from "./page-layout";

/** Loading placeholders shaped like each screen, so nothing jumps when data arrives. */

function HeaderSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <Card className="grid grid-cols-2 gap-px overflow-hidden lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="grid gap-2 p-4 md:p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </Card>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-2 border-b p-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-40" />
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-b px-5 py-3 last:border-0">
          <Skeleton className="size-8 rounded-full" />
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </Card>
  );
}

function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="grid gap-3 p-5">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="size-8 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </Card>
  );
}

export function TableScreenSkeleton({ stats = false }: { stats?: boolean }) {
  return (
    <Page>
      <span className="sr-only">Loading</span>
      <HeaderSkeleton />
      {stats && <StatsSkeleton />}
      <TableSkeleton />
    </Page>
  );
}

export function DashboardSkeleton() {
  return (
    <Page>
      <span className="sr-only">Loading</span>
      <HeaderSkeleton />
      <StatsSkeleton />
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-[360px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </Page>
  );
}

export function TwoColumnSkeleton() {
  return (
    <Page>
      <span className="sr-only">Loading</span>
      <HeaderSkeleton />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ListCardSkeleton rows={5} />
        <div className="grid gap-5">
          <ListCardSkeleton rows={2} />
          <ListCardSkeleton rows={2} />
        </div>
      </div>
    </Page>
  );
}

export function ScheduleSkeleton() {
  return (
    <Page className="gap-4">
      <span className="sr-only">Loading</span>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-40" />
      </div>
      <Card className="grid gap-px overflow-hidden p-0">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex gap-1 p-1">
            <Skeleton className="h-16 w-16 shrink-0" />
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="h-16 flex-1 opacity-60" />
            ))}
          </div>
        ))}
      </Card>
    </Page>
  );
}

export function SettingsSkeleton() {
  return (
    <Page>
      <span className="sr-only">Loading</span>
      <HeaderSkeleton />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex gap-1 lg:w-52 lg:flex-col">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28 lg:w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <TableSkeleton rows={4} columns={3} />
        </div>
      </div>
    </Page>
  );
}
