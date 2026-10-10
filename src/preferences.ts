import { z } from "zod";

export const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const unit = z.number().min(0).max(1);
export const soundIds = [
  "fireplace",
  "nature",
  "ocean",
  "rain",
  "cafe",
  "forest",
  "brown",
  "white",
  "thunder",
  "keyboard",
  "fan",
  "theta",
] as const;
export type SoundId = (typeof soundIds)[number];
export const alarmIds = [
  "chime",
  "bell",
  "digital",
  "wood",
  "bowl",
  "rise",
  "silent",
  "custom",
] as const;
export type AlarmId = (typeof alarmIds)[number];
export const backgroundSchema = z.object({
  preset: z.string().max(100),
  type: z.enum(["solid", "gradient", "image", "animation", "upload"]),
  color: hex,
  stops: z.array(hex).min(2).max(4),
  angle: z.number().min(0).max(360),
  brightness: z.number().min(0.15).max(1.6),
  overlay: hex,
  opacity: unit,
  blur: z.number().min(0).max(20),
  fit: z.enum(["cover", "contain"]),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  speed: z.number().min(0.2).max(3),
  intensity: unit,
  paused: z.boolean(),
  grain: z.boolean(),
  vignette: z.boolean(),
  mediaId: z.string().max(100),
});
export type BackgroundConfig = z.infer<typeof backgroundSchema>;
export const defaultBackground: BackgroundConfig = {
  preset: "midnight-library",
  type: "solid",
  color: "#1c1d19",
  stops: ["#1c1d19", "#38433b"],
  angle: 145,
  brightness: 1,
  overlay: "#10130f",
  opacity: 0,
  blur: 0,
  fit: "cover",
  x: 50,
  y: 50,
  speed: 1,
  intensity: 0.55,
  paused: false,
  grain: false,
  vignette: false,
  mediaId: "",
};
const displaySchema = z.object({
  style: z.enum(["digital", "serif", "flip", "ring", "bar", "matrix"]),
  size: z.number().min(60).max(130),
  font: z.enum(["sans", "serif", "mono"]),
  weight: z.enum(["400", "500", "600"]),
  digitColor: z.union([hex, z.literal("")]),
  accent: z.union([hex, z.literal("")]),
  seconds: z.boolean(),
  progress: z.boolean(),
  tallies: z.enum(["dots", "bars", "numbers"]),
});
const layoutSchema = z.object({
  companionOpen: z.boolean().default(true),
  tasks: z.boolean(),
  notes: z.boolean(),
  history: z.boolean(),
  exam: z.boolean(),
  date: z.boolean(),
  music: z.boolean(),
  position: z.enum(["workspace", "centered"]),
  density: z.enum(["comfortable", "compact"]),
  companionWidth: z.number().min(260).max(440),
  autoHide: z.boolean(),
  greeting: z.string().max(100),
  quotes: z.boolean(),
  lowPower: z.boolean(),
});
const levelsSchema = z.object(
  Object.fromEntries(soundIds.map((id) => [id, unit])) as Record<
    SoundId,
    typeof unit
  >,
);
const mixSchema = z.object({ master: unit, levels: levelsSchema });
export const roomPresetSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(80),
  theme: z.enum(["midnight", "paper", "rain"]),
  background: backgroundSchema,
  breakBackground: backgroundSchema,
  sameBackground: z.boolean(),
  display: displaySchema,
  layout: layoutSchema,
  mix: mixSchema,
});
export type RoomPreset = z.infer<typeof roomPresetSchema>;
export const preferencesSchema = z.object({
  view: z.enum(["timer", "clock", "pomodoro", "stopwatch"]),
  background: backgroundSchema,
  breakBackground: backgroundSchema,
  sameBackground: z.boolean(),
  favorites: z.array(z.string().max(100)).max(100),
  display: displaySchema,
  layout: layoutSchema,
  clock: z.object({
    hour12: z.boolean(),
    seconds: z.boolean(),
    date: z.boolean(),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v || undefined });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone"),
  }),
  cycles: z.object({ autoBreak: z.boolean(), autoFocus: z.boolean() }),
  mixer: mixSchema.extend({
    onEnd: z.enum(["continue", "fade", "pause"]),
    presets: z
      .array(
        mixSchema.extend({
          id: z.string().max(100),
          name: z.string().min(1).max(80),
        }),
      )
      .max(30),
  }),
  alarms: z.object({
    focus: z.enum(alarmIds),
    break: z.enum(alarmIds),
    volume: unit,
    fade: z.boolean(),
    repeat: z.number().int().min(1).max(5),
    mediaId: z.string().max(100),
  }),
  spotify: z.object({
    enabled: z.boolean(),
    expanded: z.boolean(),
    selected: z.string().max(100),
    favorites: z
      .array(
        z.object({
          id: z.string().regex(/^(playlist|album|track):[A-Za-z0-9]{22}$/),
          name: z.string().min(1).max(100),
        }),
      )
      .max(50),
  }),
  rooms: z.array(roomPresetSchema).max(30),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const zeroLevels = (): Record<SoundId, number> =>
  Object.fromEntries(soundIds.map((id) => [id, 0])) as Record<SoundId, number>;
export function defaultPreferences(): Preferences {
  return {
    view: "pomodoro",
    background: { ...defaultBackground },
    breakBackground: {
      ...defaultBackground,
      preset: "forest-mist",
      type: "image",
      opacity: 0.4,
    },
    sameBackground: true,
    favorites: [],
    display: {
      style: "ring",
      size: 100,
      font: "sans",
      weight: "400",
      digitColor: "",
      accent: "",
      seconds: true,
      progress: true,
      tallies: "dots",
    },
    layout: {
      companionOpen: false,
      tasks: true,
      notes: true,
      history: true,
      exam: true,
      date: true,
      music: false,
      position: "workspace",
      density: "comfortable",
      companionWidth: 310,
      autoHide: false,
      greeting: "",
      quotes: false,
      lowPower: false,
    },
    clock: { hour12: false, seconds: true, date: true, timezone: "" },
    cycles: { autoBreak: false, autoFocus: false },
    mixer: {
      master: 0.6,
      levels: { ...zeroLevels(), brown: 0.35 },
      onEnd: "continue",
      presets: [],
    },
    alarms: {
      focus: "chime",
      break: "bell",
      volume: 0.35,
      fade: false,
      repeat: 1,
      mediaId: "",
    },
    spotify: { enabled: false, expanded: false, selected: "", favorites: [] },
    rooms: [],
  };
}
export function parsePreferences(value: unknown): Preferences {
  const result = preferencesSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      `Invalid room preferences: ${result.error.issues[0]?.path.join(".")}`,
    );
  return result.data;
}
