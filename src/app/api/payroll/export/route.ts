import type { NextRequest } from "next/server";

import { ForbiddenError } from "@/server/auth/permissions";
import { exportPayrollCsv } from "@/server/loaders/payroll-page";

/** Payroll as CSV. Owner only, checked by the same service the page uses. */
export async function GET(request: NextRequest) {
  try {
    const { csv, filename } = await exportPayrollCsv(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Not allowed." }, { status: 403 });
    }
    throw error;
  }
}
