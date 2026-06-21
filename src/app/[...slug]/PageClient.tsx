"use client";

import { JMAppHeader } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import type { PageMeta, ResolvedSegment } from "@/lib/content-server";
import { PageSegments, segmentsHaveContent } from "@/app/_home/PageSegments";

interface PageClientProps {
  page: PageMeta;
  segments: ResolvedSegment[];
}

/**
 * Renderer for a standalone Page: an optional title/subtitle header plus the
 * shared segment stack. Content arrives from the server component (Admin SDK).
 */
export default function PageClient({ page, segments }: PageClientProps) {
  const { theme } = useJMStyle();
  const hasContent = segmentsHaveContent(segments);

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />

      <main className="pb-12">
        {/* Page header — omitted for header-less pages (e.g. the home page). */}
        {!page.hideHeader && (page.title || page.subtitle) && (
          <div className="px-4 pt-6 sm:px-6">
            {page.title && (
              <h1
                className="text-3xl font-bold sm:text-4xl"
                style={{ color: theme.text.primary }}
              >
                {page.title}
              </h1>
            )}
            {page.subtitle && (
              <p className="mt-1 text-base" style={{ color: theme.text.secondary }}>
                {page.subtitle}
              </p>
            )}
          </div>
        )}

        <PageSegments segments={segments} />

        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="max-w-md text-lg" style={{ color: theme.text.secondary }}>
              This page has no content yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
