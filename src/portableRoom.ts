import { z } from "zod";
import { roomPresetSchema, type RoomPreset } from "./preferences";
import { captureRoom } from "./roomPresets";
import type { Store } from "./types";
const portableSchema = z.object({
  kind: z.literal("stillroom-room"),
  version: z.literal(1),
  room: roomPresetSchema,
  omittedMedia: z.array(z.string().max(100)).max(2),
});
export function portableRoom(store: Store) {
  const room = captureRoom(store, "Shared room");
  room.id = "shared-room";
  room.layout = { ...room.layout, greeting: "", music: false };
  const omittedMedia: string[] = [];
  for (const bg of [room.background, room.breakBackground]) {
    if (bg.type === "upload") {
      omittedMedia.push("Uploaded background");
      bg.type = "solid";
      bg.preset = "custom";
    }
    bg.mediaId = "";
  }
  return {
    kind: "stillroom-room" as const,
    version: 1 as const,
    room,
    omittedMedia,
  };
}
export function parsePortableRoom(value: unknown): RoomPreset {
  const result = portableSchema.parse(value);
  const room = result.room;
  room.layout.greeting = "";
  room.layout.music = false;
  for (const bg of [room.background, room.breakBackground]) {
    bg.mediaId = "";
    if (bg.type === "upload") {
      bg.type = "solid";
      bg.preset = "custom";
    }
  }
  return room;
}
export function downloadRoom(store: Store) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(portableRoom(store), null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "stillroom-room.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
