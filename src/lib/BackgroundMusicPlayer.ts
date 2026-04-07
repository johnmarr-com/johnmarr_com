/**
 * Singleton background music player.
 *
 * Only one track plays at a time. Survives component mount/unmount cycles
 * because the instance lives at module scope. Call `bgMusic.stop()` when
 * leaving the context that started playback (e.g. navigating home).
 */

class BackgroundMusicPlayer {
  private static instance: BackgroundMusicPlayer | null = null;

  private audio: HTMLAudioElement | null = null;
  private currentURL: string | null = null;
  private pendingURL: string | null = null;
  private interactionBound = false;

  private constructor() {}

  static getInstance(): BackgroundMusicPlayer {
    if (!BackgroundMusicPlayer.instance) {
      BackgroundMusicPlayer.instance = new BackgroundMusicPlayer();
    }
    return BackgroundMusicPlayer.instance;
  }

  /**
   * Start looping a track. If the same URL is already playing, this is a no-op.
   * Falls back gracefully if the browser blocks autoplay — the track will
   * start on the next user interaction (click / tap / key).
   */
  play(url: string, volume = 0.3): void {
    if (typeof window === "undefined") return;

    if (this.currentURL === url && this.audio && !this.audio.paused) {
      this.audio.volume = volume;
      return;
    }

    this.stop();

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    this.audio = audio;
    this.currentURL = url;

    const promise = audio.play();
    if (promise) {
      promise.catch(() => {
        this.pendingURL = url;
        this.bindInteractionResume();
      });
    }
  }

  stop(): void {
    this.pendingURL = null;

    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.load();
      this.audio = null;
    }
    this.currentURL = null;
  }

  get playing(): boolean {
    return !!this.audio && !this.audio.paused;
  }

  /* Resume playback after the browser grants audio via a user gesture. */
  private handleInteraction = (): void => {
    if (this.pendingURL && this.audio) {
      this.audio.play().catch(() => {});
      this.pendingURL = null;
    }
    this.unbindInteractionResume();
  };

  private bindInteractionResume(): void {
    if (this.interactionBound) return;
    this.interactionBound = true;
    const opts: AddEventListenerOptions = { once: true, capture: true };
    document.addEventListener("click", this.handleInteraction, opts);
    document.addEventListener("touchstart", this.handleInteraction, opts);
    document.addEventListener("keydown", this.handleInteraction, opts);
  }

  private unbindInteractionResume(): void {
    if (!this.interactionBound) return;
    this.interactionBound = false;
    document.removeEventListener("click", this.handleInteraction, true);
    document.removeEventListener("touchstart", this.handleInteraction, true);
    document.removeEventListener("keydown", this.handleInteraction, true);
  }
}

export const bgMusic =
  typeof window !== "undefined"
    ? BackgroundMusicPlayer.getInstance()
    : (({
        play() {},
        stop() {},
        playing: false,
      } as unknown) as BackgroundMusicPlayer);
