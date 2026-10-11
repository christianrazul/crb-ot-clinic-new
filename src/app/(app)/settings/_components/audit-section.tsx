"use client";

import * as React from "react";

import { EmptyState } from "@/components/app/detail-bits";
import { SectionHead } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManila } from "@/lib/dates";
import type { AuditPage } from "@/server/services/audit";

import { listAuditLogAction } from "../actions";

const ALL = "all";
const label = (entity: string) => entity.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Read-only trail of every create, update and status change. */
export function AuditSection() {
  const [entity, setEntity] = React.useState(ALL);
  const [entities, setEntities] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<AuditPage["rows"] | null>(null);
  const [next, setNext] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback((filter: string, beforeId?: number) => {
    startTransition(async () => {
      const result = await listAuditLogAction({
        entity: filter === ALL ? undefined : filter,
        beforeId,
      });
      if (!result.ok) return setError(result.error);
      setError(null);
      setEntities(result.data.entities);
      setRows((current) =>
        beforeId && current ? [...current, ...result.data.page.rows] : result.data.page.rows,
      );
      setNext(result.data.page.nextBeforeId);
    });
  }, []);

  React.useEffect(() => load(ALL), [load]);

  return (
    <>
      <SectionHead
        title="Audit log"
        description="Every change to patients, sessions, payments, credit and settings. Entries can't be edited."
      >
        <Select
          value={entity}
          onValueChange={(value) => {
            setEntity(value);
            load(value);
          }}
        >
          <SelectTrigger className="h-8 w-[180px] text-[13px]" aria-label="Record type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL}>All records</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {label(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SectionHead>
      <Card className="overflow-hidden">
        {error ? (
          <EmptyState title="Couldn't load the audit log" description={error} />
        ) : !rows ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatManila(new Date(row.createdAt), "date")}{" "}
                    {formatManila(new Date(row.createdAt), "time")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.actorName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {row.action}
                    </Badge>
                    {(row.before !== null || row.after !== null) && (
                      <details className="mt-1.5 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Changes</summary>
                        <pre className="mt-1 max-w-[420px] overflow-x-auto rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
                          {row.before !== null &&
                            `Before: ${JSON.stringify(row.before, null, 1)}\n`}
                          {row.after !== null && `After: ${JSON.stringify(row.after, null, 1)}`}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {label(row.entity)} {row.entityId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No entries yet" description="Changes show here as people work." />
        )}
      </Card>
      {next !== null && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => load(entity, next)}>
            Show older entries
          </Button>
        </div>
      )}
    </>
  );
}
