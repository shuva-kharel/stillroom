import type { Store, Theme } from "./types";
import {
  defaultPreferences,
  type RoomPreset,
  type Preferences,
} from "./preferences";
import { backgrounds } from "./backgrounds/catalog";
import { mixerPresets } from "./sound/presets";
export function captureRoom(store: Store, name: string): RoomPreset {
  const p = store.preferences;
  return {
    id: crypto.randomUUID(),
    name,
    theme: store.settings.theme,
    background: structuredClone(p.background),
    breakBackground: structuredClone(p.breakBackground),
    sameBackground: p.sameBackground,
    display: { ...p.display },
    layout: { ...p.layout },
    mix: { master: p.mixer.master, levels: { ...p.mixer.levels } },
  };
}
export function applyRoom(store: Store, room: RoomPreset): Store {
  const p = store.preferences;
  return {
    ...store,
    study: { ...store.study, selectedRoom: room.id },
    settings: { ...store.settings, theme: room.theme },
    preferences: {
      ...p,
      background: structuredClone(room.background),
      breakBackground: structuredClone(room.breakBackground),
      sameBackground: room.sameBackground,
      display: { ...room.display },
      layout: { ...room.layout },
      mixer: { ...p.mixer, ...structuredClone(room.mix) },
    },
  };
}
function builtin(
  id: string,
  name: string,
  background: string,
  style: Preferences["display"]["style"],
  theme: Theme = "midnight",
  mix = "rainy-library",
): RoomPreset {
  const p = defaultPreferences();
  return {
    id,
    name,
    theme,
    background: { ...backgrounds.find((b) => b.id === background)!.config },
    breakBackground: p.breakBackground,
    sameBackground: true,
    display: { ...p.display, style },
    layout: {
      ...p.layout,
      position: id === "minimal-exam" ? "centered" : "workspace",
      tasks: id !== "minimal-exam",
      notes: id !== "minimal-exam",
      history: id !== "minimal-exam",
    },
    mix: {
      master: 0.55,
      levels: { ...mixerPresets.find((m) => m.id === mix)!.levels },
    },
  };
}
export const builtinRooms = [
  builtin("deep-work", "Deep Work", "midnight-library", "ring"),
  builtin("maths-practice", "Maths Practice", "ink-black", "digital"),
  builtin("reading", "Reading", "paper-desk", "serif", "paper", "quiet-fan"),
  builtin("rainy-evening", "Rainy Evening", "gentle-rain", "flip", "rain"),
  builtin(
    "minimal-exam",
    "Minimal Exam Mode",
    "blue-hour",
    "bar",
    "rain",
    "quiet-fan",
  ),
];
