import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { buildSummarizerMessages } from "@/lib/agents/summarizer";
import { SUMMARIZER_MODEL } from "@/lib/agents/config";
import { fetchOpenRouterCost } from "@/lib/agents/cost";

export const runtime = "nodejs";

const Body = z.object({
  chapterTitle: z.string().min(1).max(500),
  chapterContent: z.string().min(1).max(200000),
  outputLanguage: z.enum(["en", "th"]),
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

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  try {
    const { text, response } = await generateText({
      model: openrouter(SUMMARIZER_MODEL),
      temperature: 0.3,
      messages: buildSummarizerMessages(
        parsed.data.chapterTitle,
        parsed.data.chapterContent,
        parsed.data.outputLanguage,
      ),
    });
    const cost = response.id
      ? await fetchOpenRouterCost(response.id, apiKey, "summarizer")
      : null;
    return Response.json({ text, cost });
  } catch (err) {
    console.error("[/api/summarize] error:", err);
    return new Response("Summarizer failed", { status: 502 });
  }
}
