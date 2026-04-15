import type { Message, Novel } from "./types";

export function buildMessages(novel: Novel): Message[] {
  const pastChapters = novel.chapters
    .map((c) => `[${c.title}]\n${c.content}`)
    .join("\n\n");

  const system = [
    "You are an expert novel writer.",
    "",
    "Here is the core story context and world-bible:",
    novel.storyContext,
    "",
    "Here are the previous chapters for continuity:",
    pastChapters || "(none yet — this is the first chapter)",
  ].join("\n");

  const user = `Write the next chapter. Guidance:\n${novel.draft.prompt}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
