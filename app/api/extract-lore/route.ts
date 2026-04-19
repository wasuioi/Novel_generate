import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { buildLoreKeeperMessages } from "@/lib/agents/loreKeeper";
import { LORE_KEEPER_MODEL } from "@/lib/agents/config";

export const runtime = "nodejs";

const Body = z.object({
  chapterTitle: z.string().min(1),
  chapterContent: z.string().min(1),
  existingLore: z.array(z.string()),
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
    const { text } = await generateText({
      model: openrouter(LORE_KEEPER_MODEL),
      temperature: 0.2,
      messages: buildLoreKeeperMessages(
        parsed.data.chapterTitle,
        parsed.data.chapterContent,
        parsed.data.existingLore,
        parsed.data.outputLanguage,
      ),
    });
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/extract-lore] error:", err);
    return new Response("Lore extraction failed", { status: 502 });
  }
}
