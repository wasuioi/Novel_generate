import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { parseSceneSuggestions } from "@/lib/agents/sceneSuggester";
import { buildAgentCall } from "@/lib/agents/prices";

export const runtime = "nodejs";

const Body = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
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
    const { text, usage } = await generateText({
      model: openrouter(parsed.data.model),
      temperature: parsed.data.temperature,
      messages: parsed.data.messages,
    });

    const parseRes = parseSceneSuggestions(text);
    if (!parseRes.ok) {
      console.error(
        "[/api/suggest-scenes] parse failed:",
        parseRes.error,
        "raw:",
        text,
      );
      return new Response(`Parse failed: ${parseRes.error}`, { status: 502 });
    }

    const cost = buildAgentCall(
      "sceneSuggester",
      parsed.data.model,
      usage.promptTokens,
      usage.completionTokens,
    );
    return Response.json({ suggestions: parseRes.suggestions, cost });
  } catch (err) {
    console.error("[/api/suggest-scenes] error:", err);
    return new Response("Scene suggestion failed", { status: 502 });
  }
}
