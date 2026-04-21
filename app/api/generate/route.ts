import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { COST_DELIMITER_HEADER } from "@/lib/agents/streamMeta";
import { MAX_OUTPUT_TOKENS } from "@/lib/agents/config";
import { buildAgentCall } from "@/lib/agents/prices";

export const runtime = "nodejs";

const Body = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive().max(MAX_OUTPUT_TOKENS),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
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
  const { model, temperature, maxTokens, messages } = parsed.data;

  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const result = streamText({
    model: openrouter(model),
    temperature,
    maxTokens,
    messages,
    onError: ({ error }) => {
      console.error("[/api/generate] streamText error:", error);
    },
  });

  const nonce = crypto.randomUUID();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        const usage = await result.usage;
        const cost = buildAgentCall(
          "writer",
          model,
          usage.promptTokens,
          usage.completionTokens,
        );
        if (cost) {
          controller.enqueue(encoder.encode(`${nonce}${JSON.stringify(cost)}`));
        }
      } catch (err) {
        console.error("[/api/generate] stream failure:", err);
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      [COST_DELIMITER_HEADER]: nonce,
    },
  });
}
