/**
 * Singleton background music player.
 *
 * Uses Web Audio API so iOS Safari can play background music alongside
 * game <video> elements. Both audio streams are routed through the same
 * AudioContext, which iOS treats as a single audio session.
 *
 * - Background music: fetched as ArrayBuffer → decoded → AudioBufferSourceNode
 * - Game video: routed via connectVideo() → MediaElementAudioSourceNode
 */

class BackgroundMusicPlayer {
  private static instance: BackgroundMusicPlayer | null = null;

  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private currentURL: string | null = null;
  private currentVolume = 0.3;
  private bufferCache = new Map<string, AudioBuffer>();
  private pendingURL: string | null = null;
  private interactionBound = false;
  private connectedVideos = new WeakSet<HTMLVideoElement>();

  private constructor() {}

  static getInstance(): BackgroundMusicPlayer {
    if (!BackgroundMusicPlayer.instance) {
      BackgroundMusicPlayer.instance = new BackgroundMusicPlayer();
    }
    return BackgroundMusicPlayer.instance;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext
        || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Start looping a track. If the same URL is already playing, this is a no-op.
   * Falls back gracefully if the browser blocks autoplay — the track will
   * start on the next user interaction (click / tap / key).
   */
  play(url: string, volume = 0.3): void {
    if (typeof window === "undefined") return;

    this.currentVolume = volume;

    if (this.currentURL === url && this.sourceNode) {
      if (this.gainNode) this.gainNode.gain.value = volume;
      return;
    }

    this.stopSource();
    this.currentURL = url;

    const ctx = this.ensureContext();

    if (ctx.state === "suspended") {
      this.pendingURL = url;
      this.bindInteractionResume();
      return;
    }

    const cached = this.bufferCache.get(url);
    if (cached) {
      this.startBuffer(cached, volume);
    } else {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((raw) => ctx.decodeAudioData(raw))
        .then((buffer) => {
          this.bufferCache.set(url, buffer);
          if (this.currentURL === url) this.startBuffer(buffer, this.currentVolume);
        })
        .catch(() => {});
    }
  }

  stop(): void {
    this.pendingURL = null;
    this.currentURL = null;
    this.stopSource();
  }

  /**
   * Route a <video> element's audio through the shared AudioContext.
   * Call once per video element (idempotent — safe to call repeatedly).
   * This allows the video and background music to coexist on iOS.
   */
  connectVideo(video: HTMLVideoElement): void {
    if (typeof window === "undefined") return;
    if (this.connectedVideos.has(video)) return;

    const ctx = this.ensureContext();
    try {
      const source = ctx.createMediaElementSource(video);
      source.connect(ctx.destination);
      this.connectedVideos.add(video);
    } catch {
      // createMediaElementSource can only be called once per element
    }
  }

  get playing(): boolean {
    return !!this.sourceNode && !!this.currentURL;
  }

  private startBuffer(buffer: AudioBuffer, volume: number): void {
    const ctx = this.ensureContext();

    this.stopSource();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(ctx.destination);
    source.start(0);

    this.sourceNode = source;
    this.gainNode = gain;
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
      try { this.sourceNode.disconnect(); } catch { /* already disconnected */ }
      this.sourceNode = null;
    }
    this.gainNode = null;
  }

  private handleInteraction = (): void => {
    const ctx = this.ctx;
    if (ctx?.state === "suspended") {
      ctx.resume().then(() => {
        if (this.pendingURL) {
          const url = this.pendingURL;
          this.pendingURL = null;
          this.play(url, this.currentVolume);
        }
      }).catch(() => {});
    } else if (this.pendingURL) {
      const url = this.pendingURL;
      this.pendingURL = null;
      this.play(url, this.currentVolume);
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
        connectVideo() {},
        playing: false,
      } as unknown) as BackgroundMusicPlayer);
