import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { load, save, STORAGE_KEY, validateImport } from "../persistence";
import { elapsed, remaining, transition, type TimerAction } from "../timer";
import { mixer } from "../sound/mixer";
import { alarms } from "../sound/alarms";
import { RoomCoordinator } from "../coordination";
import type { Preferences } from "../preferences";
import type { Store } from "../types";
export function useRoom() {
  const [loaded] = useState(load);
  const [store, rawSetStore] = useState(loaded.store);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [coordinator] = useState(() => new RoomCoordinator());
  const ownership = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
  );
  const [now, setNow] = useState(Date.now()),
    [storageError, setStorageError] = useState(""),
    [saved, setSaved] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    undo?: () => void;
  } | null>(loaded.warning ? { message: loaded.warning } : null);
  const previous = useRef(store.timer),
    writeBlocked = useRef(loaded.writeBlocked ?? false),
    receivedShared = useRef(false);
  const toast = useCallback(
    (message: string, undo?: () => void) => setNotification({ message, undo }),
    [],
  );
  const setStore: Dispatch<SetStateAction<Store>> = useCallback(
    (value) => {
      if (!coordinator.canWrite) {
        toast(
          "This room is controlled in another tab. Take over here to make changes.",
        );
        return;
      }
      if (typeof value !== "function") writeBlocked.current = false;
      rawSetStore(value);
    },
    [coordinator, toast],
  );
  const update = useCallback(
    (patch: Partial<Preferences>) =>
      setStore((s) => ({ ...s, preferences: { ...s.preferences, ...patch } })),
    [setStore],
  );
  useEffect(() => {
    coordinator.onAcquire = () => {
      const latest = receivedShared.current
        ? { store: storeRef.current, writeBlocked: false }
        : load();
      writeBlocked.current = latest.writeBlocked ?? false;
      const recovered = transition(
        latest.store,
        { type: "tick" },
        Date.now(),
        false,
      );
      previous.current = recovered.timer;
      storeRef.current = recovered;
      rawSetStore(recovered);
    };
    const unsubscribe = coordinator.onState((state) => {
      receivedShared.current = true;
      storeRef.current = state;
      rawSetStore(state);
    });
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue && !coordinator.canWrite)
        try {
          const state = validateImport(JSON.parse(event.newValue));
          receivedShared.current = true;
          storeRef.current = state;
          rawSetStore(state);
        } catch {
          /* Invalid external writes cannot replace the live room. */
        }
    };
    const pageHide = () => {
      coordinator.close();
      mixer.close();
      alarms.close();
    };
    const pageShow = (e: PageTransitionEvent) => {
      if (e.persisted) coordinator.start();
    };
    coordinator.start();
    coordinator.requestState();
    window.addEventListener("storage", storage);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
    return () => {
      unsubscribe();
      coordinator.close();
      window.removeEventListener("storage", storage);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
      mixer.close();
      alarms.close();
    };
  }, [coordinator]);
  useEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme;
    document.documentElement.style.setProperty(
      "--user-accent",
      store.preferences.display.accent || "var(--accent)",
    );
  }, [store.settings.theme, store.preferences.display.accent]);
  useEffect(() => {
    if (!coordinator.canWrite) return;
    try {
      if (writeBlocked.current)
        throw new Error("Recovery copy could not be retained.");
      save(store);
      setStorageError("");
      setSaved(true);
    } catch {
      setStorageError(
        writeBlocked.current
          ? "Saved data could not be recovered safely. This room is in memory only; export a backup before closing. Original storage has been preserved."
          : "Changes are kept in memory only. Browser storage is unavailable or full; export a backup before closing.",
      );
      setSaved(false);
    }
    coordinator.publish(store);
  }, [store, ownership, coordinator]);
  useEffect(() => {
    if (ownership === "viewer") {
      mixer.stopAll();
      alarms.stop();
      coordinator.requestState();
    }
  }, [ownership, coordinator]);
  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (coordinator.canWrite)
        rawSetStore((s) =>
          transition(s, { type: "tick" }, time, !document.hidden),
        );
    };
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [coordinator]);
  useEffect(() => {
    if (store.notice && coordinator.canWrite) {
      toast(store.notice);
      rawSetStore((s) => ({ ...s, notice: "" }));
    }
  }, [store.notice, coordinator, toast]);
  useEffect(() => {
    const old = previous.current;
    const completed =
      coordinator.canWrite &&
      old.id !== store.timer.id &&
      old.runningSince !== null &&
      old.mode !== "stopwatch" &&
      elapsed(old, Date.now()) >= old.duration;
    if (completed) {
      mixer.finish(store.preferences.mixer.onEnd);
      const deadline = old.runningSince! + old.duration - old.elapsed;
      if (Date.now() - deadline < 2000) {
        if (store.settings.sound)
          void alarms
            .play(
              old.mode === "short" || old.mode === "long"
                ? store.preferences.alarms.break
                : store.preferences.alarms.focus,
              store.preferences.alarms,
            )
            .catch((e) => toast(e.message));
        if (
          store.settings.notifications &&
          "Notification" in window &&
          Notification.permission === "granted"
        )
          try {
            new Notification("Stillroom · session complete", {
              body: "Your room is ready for the next chapter.",
              icon: new URL("favicon.svg", document.baseURI).href,
            });
          } catch {
            /* Browser limitations. */
          }
      }
    }
    previous.current = store.timer;
  }, [
    store.timer,
    store.settings,
    store.preferences.alarms,
    store.preferences.mixer.onEnd,
    coordinator,
    toast,
  ]);
  useEffect(() => {
    mixer.setMaster(store.preferences.mixer.master);
    mixer.active.forEach((id) =>
      mixer.setVolume(id, store.preferences.mixer.levels[id]),
    );
  }, [store.preferences.mixer.master, store.preferences.mixer.levels]);
  useEffect(() => {
    if (!notification || notification.undo) return;
    const timer = setTimeout(() => setNotification(null), 8000);
    return () => clearTimeout(timer);
  }, [notification]);
  const act = useCallback(
    (action: TimerAction) => {
      if (!coordinator.canWrite) {
        toast("Take over this room to control the timer.");
        return;
      }
      setNow(Date.now());
      rawSetStore((s) => transition(s, action, Date.now(), !document.hidden));
      if (action.type === "toggle") void alarms.unlock().catch(() => {});
    },
    [coordinator, toast],
  );
  useEffect(() => {
    const value = remaining(store.timer, now);
    const seconds =
      store.timer.mode === "stopwatch"
        ? Math.floor(value / 1000)
        : Math.ceil(value / 1000);
    document.title = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")} · ${store.timer.mode === "countdown" ? "Timer" : store.timer.mode === "stopwatch" ? "Stopwatch" : store.timer.mode === "focus" ? "Focus" : "Break"} — Stillroom`;
  }, [store.timer, now]);
  return {
    store,
    setStore,
    now,
    act,
    update,
    notification,
    setNotification,
    toast,
    storageError,
    saved,
    ownership,
    takeOver: coordinator.takeOver,
  };
}
