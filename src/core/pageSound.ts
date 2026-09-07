/**
 * Gerador de som de folheamento de página usando Web Audio API.
 * Produz um burst de white noise filtrado (~150ms) que simula
 * o som de uma página de papel virando.
 * Mute por padrão — o usuário ativa manualmente.
 */

export class PageSound {
  private audioCtx: AudioContext | null = null;
  private isMuted = true;
  private volume = 0.15;

  /** Lazy-init do AudioContext (requer interação do usuário) */
  private ensureContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public play(): void {
    if (this.isMuted) return;

    try {
      const ctx = this.ensureContext();
      const duration = 0.15;
      const sampleRate = ctx.sampleRate;
      const frameCount = Math.floor(sampleRate * duration);

      // Create white noise buffer
      const buffer = ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Bandpass filter for paper-like sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.8;

      // Gain envelope: quick attack, medium release
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start(now);
      source.stop(now + duration);
    } catch {
      // Silently ignore audio failures
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      // Init context on first unmute (requires user gesture)
      this.ensureContext();
    }
    return !this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}
