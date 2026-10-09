import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { fetchPostingDetails } from "@/server/services/posting-import";

export const runtime = "nodejs";

const inputSchema = z.object({ url: z.url().max(2048) });

export async function POST(request: Request) {
  await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = inputSchema.safeParse(body);
  if (!input.success) {
    return Response.json({ error: "Enter a valid posting URL." }, { status: 400 });
  }

  try {
    const details = await fetchPostingDetails(input.data.url);
    return Response.json({ details });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not read this posting." },
      { status: 422 },
    );
  }
}
