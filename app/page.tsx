"use client";
import { useState } from "react";
import { NovelProvider } from "@/lib/store";
import { ReviewProvider } from "@/lib/review";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { StoryContextEditor } from "@/components/StoryContextEditor";
import { ChapterWorkspace } from "@/components/ChapterWorkspace";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { LandingPage } from "@/components/LandingPage";

const SEEN_LANDING_KEY = "novel-generate:seen-landing";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [draftActive, setDraftActive] = useState(false);
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(SEEN_LANDING_KEY);
  });

  if (showLanding) {
    const firstVisit =
      typeof window !== "undefined" &&
      !window.localStorage.getItem(SEEN_LANDING_KEY);
    return (
      <LandingPage
        returning={!firstVisit}
        onStart={() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SEEN_LANDING_KEY, "1");
          }
          setShowLanding(false);
        }}
      />
    );
  }

  return (
    <NovelProvider>
      <ReviewProvider>
        <div className="flex min-h-screen">
          <ChapterSidebar
            viewingId={viewingId}
            onView={setViewingId}
            draftActive={draftActive}
            onStartDraft={() => setDraftActive(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHelp={() => setShowLanding(true)}
          />
          <main className="flex-1 p-6 max-w-3xl space-y-8">
            <StoryContextEditor />
            <ChapterWorkspace
              viewingId={viewingId}
              onClearView={() => setViewingId(null)}
              draftActive={draftActive}
              onEndDraft={() => setDraftActive(false)}
            />
          </main>
          <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </ReviewProvider>
    </NovelProvider>
  );
}
