export const SUMMARIZER_MODEL = "anthropic/claude-haiku-4.5";
export const LORE_KEEPER_MODEL = "anthropic/claude-haiku-4.5";
export const SLIDING_WINDOW_FULL_COUNT = 1;
export const AGENT_TIMEOUT_MS = 45_000;

// Thai prose fragments into ~7 tokens/word, English into ~2. Used to cap
// the writer's output tokens at a rough word-count target.
export const TOKENS_PER_WORD: Record<"en" | "th", number> = {
  en: 2,
  th: 7,
};
export const MAX_OUTPUT_TOKENS = 28000;
