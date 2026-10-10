import type { SoundId } from "../preferences";
export const soundCatalog: {
  id: SoundId;
  name: string;
  category: string;
  description: string;
}[] = [
  {
    id: "fireplace",
    name: "Fireplace",
    category: "Cozy",
    description: "Synthesized crackle & low embers",
  },
  {
    id: "nature",
    name: "Nature",
    category: "Nature",
    description: "Synthesized brook & morning birds",
  },
  {
    id: "ocean",
    name: "Ocean",
    category: "Nature",
    description: "Procedural rolling surf",
  },
  {
    id: "rain",
    name: "Rain",
    category: "Weather",
    description: "Procedural rainfall & droplets",
  },
  {
    id: "cafe",
    name: "Café",
    category: "Cozy",
    description: "Synthesized murmurs & cup clinks",
  },
  {
    id: "forest",
    name: "Forest",
    category: "Nature",
    description: "Procedural canopy wind & insects",
  },
  {
    id: "brown",
    name: "Brown Noise",
    category: "Noise",
    description: "Deep, softly filtered noise",
  },
  {
    id: "white",
    name: "White Noise",
    category: "Noise",
    description: "An even broadband texture",
  },
  {
    id: "thunder",
    name: "Thunder",
    category: "Weather",
    description: "Synthesized distant rumbles",
  },
  {
    id: "keyboard",
    name: "Keyboard",
    category: "Cozy",
    description: "Procedural key taps & spacebars",
  },
  {
    id: "fan",
    name: "Fan",
    category: "Noise",
    description: "Filtered air & a motor hum",
  },
  {
    id: "theta",
    name: "Theta Waves",
    category: "Tones",
    description: "180 / 186 Hz binaural tones · headphones",
  },
];
// Original DSP textures. No recordings or third-party audio assets are used.
export function synthesize(
  id: SoundId,
  rate: number,
  duration = 12,
): Float32Array[] {
  const length = Math.floor(rate * duration);
  const channels = id === "theta" ? 2 : 1;
  const result = Array.from(
    { length: channels },
    () => new Float32Array(length),
  );
  let brown = 0,
    soft = 0,
    crackle = 0;
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const n = random() * 2 - 1;
    brown = (brown + 0.018 * n) / 1.018;
    soft += 0.09 * (n - soft);
    const low = brown * 4;
    let sample = 0;
    switch (id) {
      case "brown":
        sample = low;
        break;
      case "white":
        sample = n * 0.35;
        break;
      case "rain":
        sample =
          (n - soft) * 0.24 +
          soft * 0.35 +
          (Math.sin(t * 37) > 0.997 ? Math.sin(t * 2400) * 0.05 : 0);
        break;
      case "ocean":
        sample =
          (soft * 0.8 + low * 0.4) *
          (0.35 + 0.65 * Math.pow((Math.sin((t * Math.PI) / 3) + 1) / 2, 2));
        break;
      case "fireplace":
        if (random() < 0.00065) crackle = 0.35 + random() * 0.6;
        crackle *= 0.994;
        sample = low * 0.42 + n * crackle + Math.sin(t * 70) * 0.025;
        break;
      case "thunder":
        sample =
          low * Math.pow((Math.sin((t * Math.PI) / 6) + 1) / 2, 7) * 1.8 +
          soft * 0.025;
        break;
      case "fan":
        sample =
          soft * 0.5 +
          Math.sin(2 * Math.PI * 60 * t) * 0.06 +
          Math.sin(2 * Math.PI * 120 * t) * 0.025 +
          low * 0.15;
        break;
      case "keyboard": {
        const period = 0.147;
        const phase = t % period;
        const gate = Math.sin(Math.floor(t / period) * 4.31) > 0.05;
        sample = gate
          ? Math.exp(-phase * 210) * (n * 0.7 + Math.sin(t * 4400) * 0.35)
          : 0;
        break;
      }
      case "nature": {
        const chirp = t % 2.4;
        sample =
          soft * 0.24 +
          low * 0.1 +
          (chirp < 0.38
            ? Math.sin(2 * Math.PI * (1700 * t + 140 * Math.sin(t * 13))) *
              Math.sin((Math.PI * chirp) / 0.38) *
              0.14
            : 0);
        break;
      }
      case "forest":
        sample =
          low * 0.5 * (0.6 + 0.4 * Math.sin(t * 0.7)) +
          n * 0.03 +
          Math.sin(2 * Math.PI * 4200 * t) *
            Math.pow(Math.max(0, Math.sin(t * 23)), 12) *
            0.035;
        break;
      case "cafe": {
        const voices = [123, 167, 213].reduce(
          (v, f, j) =>
            v +
            Math.sin(2 * Math.PI * f * t + Math.sin(t * 4 + j)) *
              Math.pow((Math.sin(t * (3 + j) + j) + 1) / 2, 2) *
              0.045,
          0,
        );
        const cup = t % 3.1;
        sample =
          soft * 0.09 +
          voices +
          Math.sin(t * 2 * Math.PI * 2300) * Math.exp(-cup * 28) * 0.13;
        break;
      }
      case "theta":
        sample = Math.sin(2 * Math.PI * 180 * t) * 0.25;
        result[1][i] = Math.sin(2 * Math.PI * 186 * t) * 0.25;
        break;
    }
    result[0][i] = sample;
  }
  // Blend the tail into the beginning; playback starts after this overlap.
  const fade = Math.floor(rate * 0.08);
  for (const data of result) {
    for (let i = 0; i < fade; i++)
      data[length - fade + i] =
        data[length - fade + i] * (1 - i / fade) + data[i] * (i / fade);
  }
  return result;
}
