export type GameStatus = "idle" | "playing" | "paused" | "won" | "lost";

export interface GameConfig {
  name: string;
  slug: string;
  maxLives: number;
  timeLimit?: number;
}

export class GameState {
  status: GameStatus = "idle";
  score = 0;
  level = 1;
  lives: number;
  elapsedTime = 0;
  readonly config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
    this.lives = config.maxLives;
  }

  start() {
    this.status = "playing";
    this.score = 0;
    this.level = 1;
    this.lives = this.config.maxLives;
    this.elapsedTime = 0;
  }

  pause() {
    if (this.status === "playing") this.status = "paused";
  }

  resume() {
    if (this.status === "paused") this.status = "playing";
  }

  addScore(points: number) {
    this.score += points;
  }

  loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.status = "lost";
    }
  }

  win() {
    this.status = "won";
  }

  reset() {
    this.status = "idle";
    this.score = 0;
    this.level = 1;
    this.lives = this.config.maxLives;
    this.elapsedTime = 0;
  }

  get isActive(): boolean {
    return this.status === "playing";
  }
}
