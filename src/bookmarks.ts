import { z } from "zod";
import type { Store } from "./types";

export function validResourceUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export const bookmarkSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(100),
  resource: z.string().trim().max(200),
  location: z.string().trim().max(200),
  url: z
    .string()
    .trim()
    .max(2048)
    .refine(
      validResourceUrl,
      "Use a complete HTTP or HTTPS URL without embedded credentials.",
    ),
  subjectId: z.string().max(100),
  taskId: z.string().max(100),
});
export type StudyBookmark = z.infer<typeof bookmarkSchema>;
export const bookmarkText = (b: StudyBookmark) =>
  [b.label, b.resource, b.location].filter(Boolean).join(" · ");
export function bookmarkSubject(s: Store, b: StudyBookmark) {
  return s.subjects.some((x) => x.id === b.subjectId) ? b.subjectId : "";
}
export function currentBookmark(s: Store, subjectId: string, taskId = "") {
  const selected = s.study.bookmarks.find(
    (b) =>
      b.id === s.study.currentBookmarks[subjectId] &&
      bookmarkSubject(s, b) === subjectId,
  );
  if (!selected) return undefined;
  // A task-specific place should not be suggested for a different valid task.
  return taskId &&
    selected.taskId &&
    s.tasks.some((t) => t.id === selected.taskId) &&
    selected.taskId !== taskId
    ? undefined
    : selected;
}
export function saveBookmark(
  s: Store,
  draft: StudyBookmark,
  current: boolean,
): Store {
  const parsed = bookmarkSchema.parse(draft);
  const subjectId = bookmarkSubject(s, parsed);
  const taskId =
    s.tasks.find((t) => t.id === parsed.taskId && t.subjectId === subjectId)
      ?.id ?? "";
  const bookmark = { ...parsed, subjectId, taskId };
  const bookmarks = s.study.bookmarks.some((b) => b.id === bookmark.id)
    ? s.study.bookmarks.map((b) => (b.id === bookmark.id ? bookmark : b))
    : [...s.study.bookmarks, bookmark];
  const currentBookmarks = Object.fromEntries(
    Object.entries(s.study.currentBookmarks).filter(
      ([, id]) => id !== bookmark.id,
    ),
  );
  if (current) currentBookmarks[subjectId] = bookmark.id;
  return { ...s, study: { ...s.study, bookmarks, currentBookmarks } };
}
export function removeBookmark(s: Store, id: string): Store {
  return {
    ...s,
    study: {
      ...s.study,
      bookmarks: s.study.bookmarks.filter((b) => b.id !== id),
      currentBookmarks: Object.fromEntries(
        Object.entries(s.study.currentBookmarks).filter(
          ([, value]) => value !== id,
        ),
      ),
    },
  };
}
