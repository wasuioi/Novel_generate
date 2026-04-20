import { z } from "zod";
import { fetchOpenRouterCost } from "@/lib/agents/cost";

export const runtime = "nodejs";

const Body = z.object({
  genId: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OPENROUTER_API_KEY is not set", { status: 500 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request body", { status: 400 });
  }

  console.log("[/api/cost] received genId =", parsed.data.genId);
  const cost = await fetchOpenRouterCost(parsed.data.genId, apiKey, "writer");
  console.log("[/api/cost] result =", cost);
  return Response.json({ cost });
}
