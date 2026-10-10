import { zeroLevels } from "../preferences";
export const mixerPresets = [
  {
    id: "rainy-library",
    name: "Rainy Library",
    master: 0.65,
    levels: { ...zeroLevels(), rain: 0.6, brown: 0.22, fireplace: 0.18 },
  },
  {
    id: "forest-morning",
    name: "Forest Morning",
    master: 0.6,
    levels: { ...zeroLevels(), nature: 0.7, forest: 0.35 },
  },
  {
    id: "cafe-study",
    name: "Café Study",
    master: 0.65,
    levels: { ...zeroLevels(), cafe: 0.65, keyboard: 0.18 },
  },
  {
    id: "ocean-night",
    name: "Ocean Night",
    master: 0.6,
    levels: { ...zeroLevels(), ocean: 0.7, thunder: 0.25 },
  },
  {
    id: "quiet-fan",
    name: "Quiet Fan",
    master: 0.55,
    levels: { ...zeroLevels(), fan: 0.7, brown: 0.15 },
  },
];
