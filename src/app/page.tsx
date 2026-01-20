"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { JMAppHeader, JMWelcomeAvatarModal, JMFeaturedCarousel, JMContentScroller } from "@/JMKit";
import type { FeaturedItem, ContentItem } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { getFeaturedContent, getTopLevelContent, getPublishedAlert } from "@/lib/content";
import type { JMContentType, JMAlert } from "@/lib/content-types";

// Define content row configuration
const CONTENT_ROWS: { type: JMContentType; title: string }[] = [
  { type: "show", title: "Shows" },
  { type: "game", title: "Games" },
  { type: "story", title: "Stories" },
  { type: "card", title: "Cards" },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const { theme } = useJMStyle();
  const router = useRouter();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasCheckedAvatar, setHasCheckedAvatar] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(true);
  const [activeAlert, setActiveAlert] = useState<JMAlert | null>(null);
  
  // Content rows state - keyed by content type
  const [contentRows, setContentRows] = useState<Record<JMContentType, ContentItem[]>>({
    show: [],
    game: [],
    story: [],
    card: [],
  });
  const [isContentLoading, setIsContentLoading] = useState(true);

  // Load featured content and alert
  useEffect(() => {
    const loadFeatured = async () => {
      try {
        const items = await getFeaturedContent();
        setFeaturedItems(items);
      } catch (error) {
        console.error("Failed to load featured content:", error);
      } finally {
        setIsFeaturedLoading(false);
      }
    };
    
    const loadAlert = async () => {
      try {
        const alert = await getPublishedAlert();
        setActiveAlert(alert);
      } catch (error) {
        console.error("Failed to load alert:", error);
      }
    };
    
    loadFeatured();
    loadAlert();
  }, []);

  // Load content rows
  useEffect(() => {
    const loadContentRows = async () => {
      try {
        // Load all content types in parallel
        const results = await Promise.all(
          CONTENT_ROWS.map(async ({ type }) => {
            const content = await getTopLevelContent(type, true);
            const items: ContentItem[] = content.map(c => ({
              id: c.id,
              name: c.name,
              coverURL: c.coverURL,
              contentType: c.contentType,
            }));
            return { type, items };
          })
        );

        // Build the content rows object
        const rows: Record<JMContentType, ContentItem[]> = {
          show: [],
          game: [],
          story: [],
          card: [],
        };
        results.forEach(({ type, items }) => {
          rows[type] = items;
        });
        
        setContentRows(rows);
      } catch (error) {
        console.error("Failed to load content:", error);
      } finally {
        setIsContentLoading(false);
      }
    };
    loadContentRows();
  }, []);

  // Check if this is a first-time user (no avatar)
  useEffect(() => {
    const checkFirstLogin = async () => {
      if (!user || hasCheckedAvatar) return;
      
      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/user/avatar", {
          headers: { "Authorization": `Bearer ${idToken}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          // Show welcome modal if no avatar assigned
          if (!data.avatarName) {
            setShowWelcomeModal(true);
          }
        }
      } catch (error) {
        console.error("Failed to check avatar:", error);
      } finally {
        setHasCheckedAvatar(true);
      }
    };

    if (user && !isLoading) {
      checkFirstLogin();
    }
  }, [user, isLoading, hasCheckedAvatar]);

  const handleFeaturedClick = (item: FeaturedItem) => {
    // Navigate to content detail page
    router.push(`/${item.contentType}/${item.contentId}`);
  };

  const handleContentClick = (item: ContentItem) => {
    // Navigate to content detail page
    router.push(`/${item.contentType}/${item.id}`);
  };

  // Check if there's any content at all
  const hasAnyContent = Object.values(contentRows).some(items => items.length > 0);

  return (
    <div 
      className="relative min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />
      
      {/* Main Content Area */}
      <main className="pb-12">
        {/* Active Alert Banner */}
        {activeAlert && (
          <div 
            className="w-full px-4 py-3 sm:px-6 sm:py-4"
            style={{ backgroundColor: theme.accents.goldenGlow }}
          >
            <p 
              className="text-center font-bold whitespace-pre-wrap text-sm sm:text-base"
              style={{ color: "#000" }}
            >
              {activeAlert.text}
            </p>
          </div>
        )}

        {/* Featured Carousel Section */}
        <section className="relative mt-4">
          {isFeaturedLoading ? (
            // Loading skeleton
            <div className="flex items-center justify-center py-20">
              <div 
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: `${theme.accents.goldenGlow}40`, borderTopColor: "transparent" }}
              />
            </div>
          ) : featuredItems.length > 0 ? (
            <JMFeaturedCarousel 
              items={featuredItems}
              onItemClick={handleFeaturedClick}
              autoplayDelay={6000}
            />
          ) : !hasAnyContent ? (
            // Empty state - only show if no featured AND no content rows
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h1 
                className="mb-4 text-4xl font-bold sm:text-5xl"
                style={{ color: theme.text.primary }}
              >
                Welcome to John Marr
              </h1>
              <p 
                className="max-w-md text-lg"
                style={{ color: theme.text.secondary }}
              >
                Content coming soon. Check back for shows, stories, games, and more.
              </p>
            </div>
          ) : null}
        </section>

        {/* Content Rows */}
        {!isContentLoading && (
          <section className="mt-4 sm:mt-6 space-y-6 sm:space-y-8">
            {CONTENT_ROWS.map(({ type, title }) => {
              const items = contentRows[type];
              if (items.length === 0) return null;
              
              return (
                <JMContentScroller
                  key={type}
                  title={title}
                  items={items}
                  onItemClick={handleContentClick}
                />
              );
            })}
          </section>
        )}
      </main>

      {/* Welcome modal for first-time users */}
      <JMWelcomeAvatarModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />
    </div>
  );
}
