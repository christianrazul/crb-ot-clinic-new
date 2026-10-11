import { ZodError } from "zod";

import { ForbiddenError } from "@/server/auth/permissions";
import { exportPatient } from "@/server/loaders/patient-export";
import { NotFoundError } from "@/server/services/errors";

/** Data subject access export: everything held about one patient, as JSON. Owner only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await exportPatient((await params).id);
    if (result.limited) {
      return Response.json({ error: "Too many exports. Try again later." }, { status: 429 });
    }
    return new Response(JSON.stringify(result.data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Not allowed." }, { status: 403 });
    }
    if (error instanceof NotFoundError || error instanceof ZodError) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    throw error;
  }
}
