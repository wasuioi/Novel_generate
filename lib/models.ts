export type ModelOption = { value: string; label: string };

// AI models offered in the UI. `value` is the OpenRouter slug sent to the
// API; `label` is the friendly name shown to the user.
export const MODEL_OPTIONS: ModelOption[] = [
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { value: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7" },
  { value: "openai/gpt-5.4", label: "GPT-5.4" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
];

export const MODEL_SLUGS: string[] = MODEL_OPTIONS.map((m) => m.value);
