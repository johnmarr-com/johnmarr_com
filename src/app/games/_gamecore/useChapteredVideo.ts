"use client";

import { useCallback, useEffect, useRef } from "react";

/** One frame at 24fps — the end-of-chapter detection window. */
const FRAME = 1 / 24;

/** A chapter's start/end second-offsets into the video. */
export interface VideoChapter {
  start: number;
  end: number;
}

interface UseChapteredVideoOptions<Name extends string> {
  /** Chapter start/end offsets keyed by name (a stable module-level table). */
  chapters: Record<Name, VideoChapter>;
  /** Chapter considered current before the first playChapter/cueChapter call. */
  initialChapter: Name;
  /** Connect the video element's audio to the shared AudioContext (iOS). */
  connectVideo: (video: HTMLVideoElement) => void;
}

/**
 * Drive a single chaptered video element (the 1v1 fight games: SweepTheLeg,
 * TapSmashArena). A RAF loop watches playback and enforces the current
 * chapter's end time — looping back to its start, freezing on the last frame,
 * or firing a one-shot onEnd callback. Hiding the tab pauses the video; on
 * return the current chapter restarts from its top so the animation never
 * resumes mid-swing.
 */
export function useChapteredVideo<Name extends string>({
  chapters,
  initialChapter,
  connectVideo,
}: UseChapteredVideoOptions<Name>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const chapterRef = useRef<Name>(initialChapter);
  const loopingRef = useRef(false);
  const freezeRef = useRef(false);
  const onEndRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);

  const videoMountRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const playChapter = useCallback(
    (
      name: Name,
      opts: { loop?: boolean; freeze?: boolean; onEnd?: () => void } = {},
    ) => {
      const v = videoRef.current;
      if (!v) return;
      connectVideo(v);
      chapterRef.current = name;
      loopingRef.current = opts.loop ?? false;
      freezeRef.current = opts.freeze ?? false;
      onEndRef.current = opts.onEnd ?? null;
      v.currentTime = chapters[name].start;
      v.play().catch(() => {});
    },
    [connectVideo, chapters],
  );

  /** Seek to a chapter's first frame and hold there, paused. */
  const cueChapter = useCallback(
    (name: Name) => {
      const v = videoRef.current;
      if (!v) return;
      connectVideo(v);
      chapterRef.current = name;
      v.currentTime = chapters[name].start;
      v.pause();
    },
    [connectVideo, chapters],
  );

  // RAF loop: watches for chapter end
  useEffect(() => {
    let active = true;
    const wasPlayingRef = { current: false };

    function tick() {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && !v.seeking) {
        const ch = chapters[chapterRef.current];
        if (v.currentTime >= ch.end - FRAME) {
          if (loopingRef.current) {
            v.currentTime = ch.start;
          } else if (freezeRef.current) {
            v.pause();
          } else {
            const cb = onEndRef.current;
            onEndRef.current = null;
            cb?.();
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onVisibilityChange() {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) {
        wasPlayingRef.current = !v.paused;
        if (!v.paused) v.pause();
      } else if (wasPlayingRef.current) {
        v.currentTime = chapters[chapterRef.current].start;
        v.play().catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [chapters]);

  return { videoRef, videoMountRef, playChapter, cueChapter };
}
