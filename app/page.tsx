"use client";
import { useEffect, useState } from "react";
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
  // null = not yet known. Server HTML and the first client render both see
  // null, so they agree — no hydration mismatch. The effect below flips it.
  const [showLanding, setShowLanding] = useState<boolean | null>(null);

  useEffect(() => {
    setShowLanding(!window.localStorage.getItem(SEEN_LANDING_KEY));
  }, []);

  if (showLanding === null) return null;

  if (showLanding) {
    const firstVisit = !window.localStorage.getItem(SEEN_LANDING_KEY);
    return (
      <LandingPage
        returning={!firstVisit}
        onStart={() => {
          window.localStorage.setItem(SEEN_LANDING_KEY, "1");
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
