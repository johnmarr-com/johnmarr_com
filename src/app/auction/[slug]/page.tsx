"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { JMAppHeader, JMVimeoPlayer, getVimeoId } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { getAuctionBySlug, getAuctionItems } from "@/lib/auction";
import type { JMAuction, JMAuctionItem } from "@/lib/content-types";
import { ArrowLeft, Play, Loader2, X, DollarSign } from "lucide-react";
import { Activity } from "@/lib/points";

function Countdown({ endDate }: { endDate: Date }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const tick = () => {
      const diff = endDate.getTime() - new Date().getTime();
      if (diff <= 0) {
        setEnded(true);
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);
  if (ended)
    return (
      <div className="text-xl font-bold" style={{ color: "#e07850" }}>
        Auction Ended
      </div>
    );
  if (!timeLeft) return null;
  return (
    <div className="flex gap-4 sm:gap-6">
      {[
        { label: "Days", val: timeLeft.d },
        { label: "Hours", val: timeLeft.h },
        { label: "Minutes", val: timeLeft.m },
        { label: "Seconds", val: timeLeft.s },
      ].map(({ label, val }) => (
        <div key={label} className="text-center">
          <div className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: "#e07850" }}>
            {String(val).padStart(2, "0")}
          </div>
          <div className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.6)" }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuctionDetailPage() {
  const params = useParams();
  const slug = params["slug"] as string;
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [auction, setAuction] = useState<JMAuction | null>(null);
  const [items, setItems] = useState<JMAuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidItem, setBidItem] = useState<JMAuctionItem | null>(null);
  const [bidValue, setBidValue] = useState("");
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [videoItem, setVideoItem] = useState<{ item: JMAuctionItem; videoType: "preview" | "story" } | null>(null);
  const [imagePreviewItem, setImagePreviewItem] = useState<JMAuctionItem | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const au = await getAuctionBySlug(slug);
      if (!au || !au.isActive) {
        setAuction(null);
        setItems([]);
        return;
      }
      setAuction(au);
      const list = await getAuctionItems(au.id, true);
      setItems(list);
    } catch (err) {
      console.error("Failed to load auction:", err);
      setError("Failed to load auction");
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBid = async () => {
    if (!bidItem || !user) return;
    const val = parseFloat(bidValue);
    if (isNaN(val) || val < 0) {
      setBidError("Enter a valid bid amount");
      return;
    }
    const effectiveMin =
      bidItem.currentBid > 0 ? Math.max(bidItem.minimumBid, bidItem.currentBid) : bidItem.minimumBid;
    if (val < effectiveMin) {
      setBidError(`Minimum bid is $${effectiveMin}`);
      return;
    }
    setIsSubmittingBid(true);
    setBidError(null);
    try {
      const auth = await import("@/lib/auth").then((m) => m.getAuth());
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not signed in");
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auction/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId: bidItem.id, value: val }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to place bid");
      setBidItem(null);
      setBidValue("");
      await load();
    } catch (err) {
      setBidError(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const openBidModal = (item: JMAuctionItem) => {
    setBidItem(item);
    setBidValue("");
    setBidError(null);
  };

  const endDate = auction?.endDate?.toDate?.();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.surfaces.base }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accents.goldenGlow }} />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.surfaces.base }}>
        <JMAppHeader />
        <div className="flex flex-col items-center justify-center pt-32 px-4">
          <h1 className="text-2xl font-bold mb-4" style={{ color: theme.text.primary }}>
            {error || "Auction not found"}
          </h1>
          <Link
            href="/auction"
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ backgroundColor: theme.surfaces.elevated1, color: theme.text.primary }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Auctions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.surfaces.base }}>
      <JMAppHeader />

      {/* Hero Banner */}
      <div className="relative w-full aspect-21/9 sm:aspect-3/1 max-h-[500px]">
        {auction.bannerURL ? (
          <Image
            src={auction.bannerURL}
            alt={auction.name}
            fill
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          />
        )}
        <Link
          href="/auction"
          className="absolute top-20 left-4 sm:left-6 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors hover:opacity-90 w-fit"
          style={{
            backgroundColor: `${theme.surfaces.base}80`,
            color: theme.text.primary,
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Auctions</span>
        </Link>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="mx-auto max-w-[800px]">
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: theme.text.primary }}>
              {auction.name}
            </h1>
            <p className="text-base mb-6" style={{ color: theme.text.secondary }}>
              {auction.description || "Silent auction for original artwork. Place your bid—if you win, we'll reach out for collection and shipping."}
            </p>
            {endDate && (
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-4 px-6 py-4 rounded-xl"
                  style={{ backgroundColor: theme.surfaces.elevated1 }}
                >
                  <Countdown endDate={endDate} />
                </div>
              </div>
            )}
          </header>

          <div className="space-y-12">
            {items.map((item) => (
              <article
                key={item.id}
                className="w-full flex flex-col sm:flex-row gap-6 sm:gap-8 items-start"
                style={{ paddingBottom: "2rem", borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
              >
                <button
                  type="button"
                  onClick={() => setImagePreviewItem(item)}
                  className="w-full sm:w-80 shrink-0 aspect-square rounded-xl overflow-hidden relative bg-black cursor-pointer"
                >
                  <Image
                    src={item.detailImageURL || item.thumbnailURL}
                    alt={item.title}
                    fill
                    className="object-cover transition-opacity hover:opacity-90"
                    sizes="(max-width: 640px) 100vw, 320px"
                  />
                </button>
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold" style={{ color: theme.text.primary }}>
                      {item.title}
                    </h2>
                    {item.subtitle && (
                      <p className="text-base mt-1" style={{ color: theme.text.secondary }}>{item.subtitle}</p>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm" style={{ color: theme.text.tertiary }}>{item.description}</p>
                  )}
                <div className="flex flex-wrap gap-4">
                  {item.videoURL && getVimeoId(item.videoURL) && (
                    <button
                      onClick={() => setVideoItem({ item, videoType: "preview" })}
                      className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
                      style={{ color: theme.accents.goldenGlow }}
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                      Watch Video Preview
                    </button>
                  )}
                  {item.videoStoryURL && getVimeoId(item.videoStoryURL) && (
                    <button
                      onClick={() => setVideoItem({ item, videoType: "story" })}
                      className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
                      style={{ color: theme.accents.goldenGlow }}
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                      Watch the Art Story
                    </button>
                  )}
                </div>
                {(item.dimensions || item.media) && (
                  <div className="text-sm" style={{ color: theme.text.tertiary }}>
                    {item.dimensions && <span>{item.dimensions}</span>}
                    {item.dimensions && item.media && " • "}
                    {item.media && <span>{item.media}</span>}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 mt-auto">
                  <div>
                    {item.currentBidWinnerName ? (
                      <p className="text-base font-medium" style={{ color: theme.accents.goldenGlow }}>
                        Current leading bid:
                        <br />
                        {item.currentBidWinnerName} @ ${item.currentBid}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: theme.text.tertiary }}>
                        No bids yet
                        {item.minimumBid > 0 && (
                          <>
                            <br />
                            Minimum bid: ${item.minimumBid}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openBidModal(item)}
                    className="flex items-center justify-center sm:justify-end gap-2 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90 shrink-0"
                    style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
                  >
                    <DollarSign className="h-4 w-4" />
                    Place Bid
                  </button>
                </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {bidItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setBidItem(null)} />
          <div
            className="relative w-full max-w-md rounded-xl p-6"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold" style={{ color: theme.text.primary }}>
                Place Bid: {bidItem.title}
              </h3>
              <button onClick={() => setBidItem(null)} className="p-2 rounded-lg hover:bg-white/10" style={{ color: theme.text.tertiary }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: theme.text.secondary }}>
              Enter your bid for this artwork. {bidItem.currentBidWinnerName && (
                <>The current leading bid is <strong style={{ color: theme.accents.goldenGlow }}>{bidItem.currentBidWinnerName}</strong> at <strong>${bidItem.currentBid}</strong>.</>
              )} Should you win, we&apos;ll reach out to arrange collection and shipping.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>Your bid ($)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={bidValue}
                onChange={(e) => setBidValue(e.target.value)}
                placeholder={`Min $${bidItem.currentBid > 0 ? Math.max(bidItem.minimumBid, bidItem.currentBid) : bidItem.minimumBid}`}
                className="w-full rounded-lg px-4 py-3"
                style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
              />
              <p className="text-xs mt-2" style={{ color: theme.text.tertiary }}>
                Minimum bid: ${bidItem.currentBid > 0 ? Math.max(bidItem.minimumBid, bidItem.currentBid) : bidItem.minimumBid}
              </p>
            </div>
            {bidError && (
              <p className="text-sm mb-4" style={{ color: theme.semantic.error }}>{bidError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setBidItem(null)} className="px-4 py-2 rounded-lg" style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary }}>Cancel</button>
              <button
                onClick={handleBid}
                disabled={isSubmittingBid}
                className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
              >
                {isSubmittingBid && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Bid
              </button>
            </div>
          </div>
        </div>
      )}

      {videoItem && (
        <JMVimeoPlayer
          vimeoURL={(videoItem.videoType === "story" ? videoItem.item.videoStoryURL : videoItem.item.videoURL) || ""}
          orientation={
            (videoItem.videoType === "story"
              ? (videoItem.item.videoStoryOrientation ?? "landscape")
              : (videoItem.item.videoOrientation ?? "landscape"))
          }
          onClose={() => setVideoItem(null)}
          pointsActivity={Activity.WATCH_VIDEO}
        />
      )}

      {imagePreviewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          onClick={() => setImagePreviewItem(null)}
        >
          <button
            onClick={() => setImagePreviewItem(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full hover:opacity-80"
            style={{ backgroundColor: "rgba(0,0,0,0.6)", border: "2px solid rgba(255,255,255,0.3)" }}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <Image
              src={imagePreviewItem.detailImageURL || imagePreviewItem.thumbnailURL}
              alt={imagePreviewItem.title}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}
