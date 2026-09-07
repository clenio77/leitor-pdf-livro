/**
 * Partículas de poeira dourada flutuando sobre a escrivaninha.
 * Canvas overlay transparente, z-index baixo, pointer-events: none.
 * Desativa automaticamente se prefers-reduced-motion ou tema diurno.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  alphaDir: number;
}

const PARTICLE_COUNT = 25;
const MAX_SPEED = 0.25;
const MIN_ALPHA = 0.05;
const MAX_ALPHA = 0.35;

export class DustParticles {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animId: number | null = null;
  private enabled = true;

  constructor(parentEl: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 3;
    `;
    parentEl.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    // Respeitar prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      this.enabled = false;
    }
    motionQuery.addEventListener('change', (e) => {
      this.enabled = !e.matches;
      if (this.enabled) this.start();
      else this.stop();
    });

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  public start(): void {
    if (!this.enabled || this.animId !== null) return;
    this.initParticles();
    this.animate();
  }

  public stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public setVisible(visible: boolean): void {
    this.canvas.style.display = visible ? 'block' : 'none';
    if (visible && this.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  private handleResize(): void {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  private initParticles(): void {
    this.particles = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * MAX_SPEED,
        vy: (Math.random() - 0.5) * MAX_SPEED * 0.6, // Slower vertical
        size: 1 + Math.random() * 2,
        alpha: MIN_ALPHA + Math.random() * (MAX_ALPHA - MIN_ALPHA),
        alphaDir: (Math.random() > 0.5 ? 1 : -1) * (0.001 + Math.random() * 0.002),
      });
    }
  }

  private animate = (): void => {
    if (!this.enabled) return;

    const { width: w, height: h } = this.canvas;
    this.ctx.clearRect(0, 0, w, h);

    for (const p of this.particles) {
      // Brownian drift
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.015;

      // Clamp speed
      p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
      p.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vy));

      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      // Alpha breathing
      p.alpha += p.alphaDir;
      if (p.alpha >= MAX_ALPHA || p.alpha <= MIN_ALPHA) {
        p.alphaDir *= -1;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(212, 155, 66, ${p.alpha})`;
      this.ctx.fill();
    }

    this.animId = requestAnimationFrame(this.animate);
  };
}
