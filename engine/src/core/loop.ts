/**
 * Bucle de tick fijo desacoplado del render.
 *
 * La simulacion avanza a `hz` pasos por segundo (por defecto 15). El render
 * corre a la frecuencia del monitor e interpola entre el ultimo tick y el
 * anterior con el `alpha` que devuelve `frameAlpha()`.
 *
 * Politica de acumulador: si el navegador se congela (pestana en segundo
 * plano, GC largo) se descartan los ticks atrasados por encima de
 * `maxCatchUp`, en vez de intentar recuperarlos. En un RTS es preferible
 * perder medio segundo de simulacion a entrar en una espiral de muerte.
 */
export interface LoopStats {
  fps: number;
  tps: number;
  tickMs: number;
  renderMs: number;
  droppedTicks: number;
}

export class FixedLoop {
  readonly stepMs: number;
  private acc = 0;
  private last = 0;
  private running = false;
  private raf = 0;
  private maxCatchUp: number;

  // Ventanas de medida (media movil sobre 30 muestras).
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fpsTimer = 0;
  readonly stats: LoopStats = { fps: 0, tps: 0, tickMs: 0, renderMs: 0, droppedTicks: 0 };
  private tickAcc = 0;
  private tickCount = 0;
  private renderAcc = 0;
  private renderCount = 0;

  constructor(
    private readonly onTick: () => void,
    private readonly onRender: (alpha: number) => void,
    hz = 15,
    maxCatchUp = 5,
  ) {
    this.stepMs = 1000 / hz;
    this.maxCatchUp = maxCatchUp;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      let dt = now - this.last;
      this.last = now;
      if (dt > 250) dt = 250; // pestana dormida: no arrastres el retraso
      this.acc += dt;

      let steps = 0;
      const t0 = performance.now();
      while (this.acc >= this.stepMs) {
        if (steps >= this.maxCatchUp) {
          const dropped = Math.floor(this.acc / this.stepMs);
          this.stats.droppedTicks += dropped;
          this.acc = 0;
          break;
        }
        this.onTick();
        this.acc -= this.stepMs;
        steps++;
      }
      const t1 = performance.now();
      if (steps > 0) {
        this.tickAcc += t1 - t0;
        this.tickCount += steps;
      }

      this.onRender(this.acc / this.stepMs);
      const t2 = performance.now();
      this.renderAcc += t2 - t1;
      this.renderCount++;

      this.fpsFrames++;
      this.fpsAcc += dt;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 500) {
        this.stats.fps = Math.round((this.fpsFrames * 1000) / this.fpsAcc);
        this.stats.tps = this.tickCount > 0 ? Math.round((this.tickCount * 1000) / this.fpsAcc) : 0;
        this.stats.tickMs = this.tickCount > 0 ? this.tickAcc / this.tickCount : 0;
        this.stats.renderMs = this.renderCount > 0 ? this.renderAcc / this.renderCount : 0;
        this.fpsFrames = 0;
        this.fpsAcc = 0;
        this.fpsTimer = 0;
        this.tickAcc = 0;
        this.tickCount = 0;
        this.renderAcc = 0;
        this.renderCount = 0;
      }
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
