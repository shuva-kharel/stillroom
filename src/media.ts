export interface MediaAsset {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  poster?: Blob;
  created: number;
}
const DB_NAME = "stillroom.media";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("assets", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("Local media storage is unavailable."));
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", mode);
    const req = operation(tx.objectStore("assets"));
    let result: T;
    req.onsuccess = () => {
      result = req.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "Could not save local media. Storage may be full. Your study data is unchanged.",
        ),
      );
    };
  });
}
export const listMedia = () =>
  transact<MediaAsset[]>("readonly", (s) => s.getAll());
export const getMedia = (id: string) =>
  transact<MediaAsset | undefined>("readonly", (s) => s.get(id));
export const removeMedia = (id: string) =>
  transact("readwrite", (s) => s.delete(id));
export const clearMedia = () => transact("readwrite", (s) => s.clear());
export async function prepareMedia(
  file: File,
  kind: "background" | "alarm",
): Promise<Omit<MediaAsset, "id" | "created">> {
  const allowed =
    kind === "alarm"
      ? ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"]
      : [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/webm",
          "video/mp4",
        ];
  const limit = kind === "alarm" ? 10 : 30;
  if (!allowed.includes(file.type))
    throw new Error(
      kind === "alarm"
        ? "Use an MP3, WAV, OGG, M4A, or WebM audio file."
        : "Use a JPG, PNG, WebP, GIF, WebM, or MP4 file.",
    );
  if (file.size > limit * 1024 * 1024 || !file.size)
    throw new Error(`Choose a nonempty file smaller than ${limit} MB.`);
  if (kind === "alarm") {
    const ctx = new AudioContext();
    try {
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      if (decoded.duration > 30)
        throw new Error("Custom alarms must be 30 seconds or shorter.");
    } catch (e) {
      throw new Error(
        e instanceof Error && e.message.includes("30 seconds")
          ? e.message
          : "This audio file cannot be decoded by your browser.",
      );
    } finally {
      await ctx.close();
    }
    return { name: file.name, type: file.type, blob: file };
  }
  const url = URL.createObjectURL(file);
  try {
    const canvas = document.createElement("canvas");
    let width = 0,
      height = 0;
    let source: CanvasImageSource;
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Video could not be decoded. Try a different MP4 or WebM.",
              ),
            ),
          8000,
        );
        video.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error("This video format is not supported by your browser."),
          );
        };
      });
      width = video.videoWidth;
      height = video.videoHeight;
      source = video;
    } else {
      const img = new Image();
      img.src = url;
      await img.decode();
      width = img.naturalWidth;
      height = img.naturalHeight;
      source = img;
    }
    if (!width || !height) throw new Error("The media has no usable image.");
    const scale = Math.min(1, 1920 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas
      .getContext("2d")!
      .drawImage(source, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not optimize this image.")),
        "image/webp",
        0.86,
      ),
    );
    const animated =
      file.type.startsWith("video/") || file.type === "image/gif";
    return {
      name: file.name,
      type: animated ? file.type : "image/webp",
      blob: animated ? file : poster,
      poster: animated ? poster : undefined,
    };
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Media could not be read.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function saveMedia(file: File, kind: "background" | "alarm") {
  const asset: MediaAsset = {
    ...(await prepareMedia(file, kind)),
    id: crypto.randomUUID(),
    created: Date.now(),
  };
  await transact("readwrite", (s) => s.put(asset));
  return asset;
}
