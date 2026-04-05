import { GameState, type GameConfig } from "./GameState";

/**
 * Base game engine — manages the game loop, timing, and state lifecycle.
 * Subclass per game to implement specific update/render logic.
 */
export class GameEngine {
  state: GameState;
  private animationFrameId: number | null = null;
  private lastTimestamp: number | null = null;
  private onUpdate: ((dt: number, state: GameState) => void) | undefined;
  private onStateChange: ((state: GameState) => void) | undefined;

  constructor(
    config: GameConfig,
    callbacks?: {
      onUpdate?: (dt: number, state: GameState) => void;
      onStateChange?: (state: GameState) => void;
    },
  ) {
    this.state = new GameState(config);
    this.onUpdate = callbacks?.onUpdate;
    this.onStateChange = callbacks?.onStateChange;
  }

  start() {
    this.state.start();
    this.lastTimestamp = null;
    this.notifyStateChange();
    this.loop();
  }

  pause() {
    this.state.pause();
    this.stopLoop();
    this.notifyStateChange();
  }

  resume() {
    this.state.resume();
    this.lastTimestamp = null;
    this.notifyStateChange();
    this.loop();
  }

  stop() {
    this.stopLoop();
    this.state.reset();
    this.notifyStateChange();
  }

  destroy() {
    this.stopLoop();
  }

  private loop = () => {
    this.animationFrameId = requestAnimationFrame((timestamp) => {
      if (!this.state.isActive) return;

      const dt = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
      this.lastTimestamp = timestamp;

      this.state.elapsedTime += dt;

      if (this.state.config.timeLimit && this.state.elapsedTime >= this.state.config.timeLimit) {
        this.state.status = "lost";
        this.notifyStateChange();
        return;
      }

      this.onUpdate?.(dt, this.state);
      this.loop();
    });
  };

  private stopLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTimestamp = null;
  }

  private notifyStateChange() {
    this.onStateChange?.(this.state);
  }
}
