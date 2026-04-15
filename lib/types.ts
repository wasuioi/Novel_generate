export type Chapter = {
  id: string;
  title: string;
  prompt: string;
  content: string;
  createdAt: number;
};

export type Settings = {
  model: string;
  temperature: number;
};

export type Draft = {
  chapterId: string | null;
  title: string;
  prompt: string;
  output: string;
};

export type Novel = {
  storyContext: string;
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
  chapters: [],
  draft: { chapterId: null, title: "", prompt: "", output: "" },
  settings: { model: "anthropic/claude-3.5-sonnet", temperature: 0.8 },
};
