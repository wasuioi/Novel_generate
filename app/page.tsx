"use client";
import { useState } from "react";
import { NovelProvider } from "@/lib/store";
import { ReviewProvider } from "@/lib/review";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { StoryContextEditor } from "@/components/StoryContextEditor";
import { ChapterWorkspace } from "@/components/ChapterWorkspace";
import { SettingsDrawer } from "@/components/SettingsDrawer";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [draftActive, setDraftActive] = useState(false);
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
          />
          <main className="flex-1 p-6 max-w-3xl space-y-8">
            <StoryContextEditor />
            <ChapterWorkspace
              viewingId={viewingId}
              onClearView={() => setViewingId(null)}
              onEndDraft={() => setDraftActive(false)}
            />
          </main>
          <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </ReviewProvider>
    </NovelProvider>
  );
}
