import { NextResponse } from "next/server";

import { buildExportRows, toCsv } from "@/lib/csv";
import { todayIn } from "@/lib/domain/dates";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { listOpportunities, listTags } from "@/server/services/queries";

/** Downloads all opportunities as CSV. Re-checks the session itself. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [opportunities, tags] = await Promise.all([
    listOpportunities(supabase, claims.sub),
    listTags(supabase, claims.sub),
  ]);

  // The BOM makes Excel read the file as UTF-8.
  const body = "﻿" + toCsv(buildExportRows(opportunities, tags));
  const filename = `internships-${todayIn(env().APP_TIMEZONE)}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
