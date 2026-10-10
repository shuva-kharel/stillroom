class RoomAudio {
  private context: AudioContext | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private async ready() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }
  async start(volume: number) {
    const ctx = await this.ready();
    this.stop();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = last * 3.5;
    }
    // Crossfade the loop seam to keep the noise continuous.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++)
      data[data.length - fade + i] =
        data[data.length - fade + i] * (1 - i / fade) + data[i] * (i / fade);
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.noise.loopStart = fade / ctx.sampleRate;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(volume, ctx.currentTime);
    this.noise.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.noise.start();
  }
  volume(value: number) {
    if (this.context && this.gain)
      this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.08);
  }
  stop() {
    this.noise?.stop();
    this.noise?.disconnect();
    this.gain?.disconnect();
    this.noise = null;
    this.gain = null;
  }
  async unlock() {
    await this.ready();
  }
  async chime(volume: number) {
    const ctx = await this.ready();
    [523.25, 659.25].forEach((frequency, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.18;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume * 0.25, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 1.2);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 1.3);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  close() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
export const roomAudio = new RoomAudio();
