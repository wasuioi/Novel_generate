export type AgentCall = {
  agent: "writer" | "summarizer" | "loreKeeper";
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type ChapterCost = {
  calls: AgentCall[];
  totalUsd: number;
};

export type Chapter = {
  id: string;
  title: string;
  prompt: string;
  content: string;
  summary: string;
  createdAt: number;
  cost?: ChapterCost;
};

export type LoreItem = {
  id: string;
  text: string;
  source: "ai" | "user";
  chapterId?: string;
  createdAt: number;
};

export type Settings = {
  model: string;
  temperature: number;
  targetWords: number;
  outputLanguage: "en" | "th";
};

export type Draft = {
  chapterId: string | null;
  title: string;
  prompt: string;
  output: string;
  writerCost?: AgentCall | null;
};

export type Novel = {
  storyContext: string;
  lore: LoreItem[];
  chapters: Chapter[];
  draft: Draft;
  settings: Settings;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const DEFAULT_NOVEL: Novel = {
  storyContext: "",
  lore: [],
  chapters: [],
  draft: { chapterId: null, title: "", prompt: "", output: "" },
  settings: {
    model: "anthropic/claude-sonnet-4.6",
    temperature: 0.8,
    targetWords: 1800,
    outputLanguage: "en",
  },
};
