"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { JMAppHeader } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { getAllAuctions } from "@/lib/auction";
import type { JMAuction } from "@/lib/content-types";
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react";

export default function AuctionIndexPage() {
  const { theme } = useJMStyle();
  const [auctions, setAuctions] = useState<JMAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await getAllAuctions(true);
        setAuctions(list);
      } catch (err) {
        console.error("Failed to load auctions:", err);
        setError("Failed to load auctions");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.surfaces.base }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accents.goldenGlow }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.surfaces.base }}>
      <JMAppHeader />

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-80"
          style={{ color: theme.text.secondary }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: theme.text.primary }}>
            Fine Art Auctions
          </h1>
          <p className="text-base" style={{ color: theme.text.secondary }}>
            Silent auctions for original artwork. Select an auction to view and bid.
          </p>
        </header>

        {error ? (
          <div className="text-center py-12" style={{ color: theme.semantic.error }}>
            {error}
          </div>
        ) : auctions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-xl"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          >
            <p className="text-lg font-medium mb-2" style={{ color: theme.text.primary }}>
              No active auctions
            </p>
            <p className="text-sm" style={{ color: theme.text.secondary }}>
              Check back later for new artwork.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {auctions.map((auction) => (
              <Link
                key={auction.id}
                href={`/auction/${auction.slug}`}
                className="flex items-center justify-between w-full px-6 py-4 rounded-xl transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: theme.surfaces.elevated1,
                  border: `1px solid ${theme.surfaces.elevated2}`,
                }}
              >
                <span className="font-semibold" style={{ color: theme.text.primary }}>
                  {auction.name}
                </span>
                <ChevronRight className="h-5 w-5" style={{ color: theme.text.tertiary }} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
