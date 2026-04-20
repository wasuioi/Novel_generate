"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { AgentCall } from "./types";

export type LoreCandidate = { text: string; checked: boolean };

export type ReviewState =
  | { kind: "idle" }
  | {
      kind: "active";
      stagedTitle: string;
      stagedPrompt: string;
      stagedContent: string;
      summary: string;
      summaryStatus: "loading" | "ready" | "error";
      loreCandidates: LoreCandidate[];
      loreStatus: "loading" | "ready" | "error";
      summarizerCost: AgentCall | null;
      loreKeeperCost: AgentCall | null;
    };

type ReviewContextValue = {
  state: ReviewState;
  setState: Dispatch<SetStateAction<ReviewState>>;
  reviewing: boolean;
};

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>({ kind: "idle" });
  return (
    <ReviewContext.Provider
      value={{ state, setState, reviewing: state.kind === "active" }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used within a ReviewProvider");
  return ctx;
}
