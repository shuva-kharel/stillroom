import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Store } from "../types";
import type { SetStore } from "./Companion";
import {
  downloadExport,
  STORAGE_KEY,
  LEGACY_KEY,
  validateImport,
} from "../persistence";
import { initialStore } from "../timer";
import { clearMedia } from "../media";
import { mixer } from "../sound/mixer";
import { alarms } from "../sound/alarms";
import { Section } from "./Controls";
import { Modal } from "./UI";
export function DataPanel({
  store,
  setStore,
  onClose,
  toast,
}: {
  store: Store;
  setStore: SetStore;
  onClose: () => void;
  toast: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const importFeedback = useRef<HTMLParagraphElement>(null);
  const [incoming, setIncoming] = useState<Store | null>(null),
    [importError, setImportError] = useState(""),
    [reading, setReading] = useState(false),
    [clearing, setClearing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cancelImport = () => {
    setIncoming(null);
    requestAnimationFrame(() => importButton.current?.focus());
  };
  useEffect(() => {
    if (importError) {
      importFeedback.current?.focus();
      importFeedback.current?.scrollIntoView({ block: "nearest" });
    }
  }, [importError]);
  return (
    <>
      <Section
        title="Private by design."
        description="Study data and preferences live in this browser. Uploaded images, videos, and alarms live in local IndexedDB. No account, tracking, or cloud sync."
      >
        <p>
          Your room is saved in this browser. No account needed. Export a backup
          to move your data to another device.
        </p>
        <ul className="privacy-list">
          <li>
            With browser storage available, your room persists across normal
            reloads and browser restarts.
          </li>
          <li>
            Clearing site data removes your saved room. Private browsing may
            remove it when the private session ends.
          </li>
          <li>
            Different devices, browser profiles, and site origins have separate
            rooms. People sharing a browser profile share the same saved room.
          </li>
          <li>
            There is no automatic cross-device sync. Export before moving to a
            different hosting domain.
          </li>
          <li>
            Small study data is stored in localStorage; uploaded media is stored
            in IndexedDB. Neither is sent to a server or stored in cookies.
          </li>
        </ul>
        <div className="privacy-note">
          Only an enabled Spotify player makes external music requests. All
          built-in backgrounds, fonts, and ambient sounds work locally.
        </div>
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() => downloadExport(store)}
          >
            <Download size={15} /> Export JSON
          </button>
          <button
            ref={importButton}
            className="secondary-button"
            disabled={reading}
            onClick={() => file.current?.click()}
          >
            <Upload size={15} /> {reading ? "Reading backup…" : "Import JSON"}
          </button>
        </div>
        <input
          ref={file}
          type="file"
          hidden
          aria-label="Import JSON backup"
          accept="application/json,.json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            setIncoming(null);
            if (!f) return;
            setReading(true);
            setImportError("");
            try {
              if (f.size > 10 * 1024 * 1024)
                throw new Error("Choose a JSON backup smaller than 10 MB.");
              const text = (await f.text()).replace(/^\uFEFF/, "");
              setIncoming(validateImport(JSON.parse(text)));
            } catch (e) {
              setImportError(
                e instanceof SyntaxError
                  ? "This file is not valid JSON. Choose a Stillroom JSON backup. Your room has not changed."
                  : `${(e as Error).message} Your room has not changed.`,
              );
            } finally {
              setReading(false);
            }
          }}
        />
        {importError && (
          <p
            ref={importFeedback}
            tabIndex={-1}
            className="error-message"
            role="alert"
          >
            {importError}
          </p>
        )}
        <p className="field-hint">
          JSON backups include study data and preferences, but omit local media
          files. Missing media falls back safely. Re-upload files on another
          device. Versions 1, 2, and 3 are supported.
        </p>
        <p className="field-hint">
          Import replaces your room; it does not merge. Your existing media
          library is retained. Incoming references may need re-uploading. Timers
          are imported paused.
        </p>
        {incoming && (
          <Modal title="Replace this room?" onClose={cancelImport}>
            <div className="form-stack">
              <p>
                This validated backup has {incoming.subjects.length} subjects,{" "}
                {incoming.tasks.length} tasks, and {incoming.history.length}{" "}
                sessions. Current study data and preferences will be replaced.
              </p>
              <p className="field-hint">
                This does not merge rooms. The imported timer will be paused.
                Existing uploaded media is retained; media files are not
                included in JSON backups.
              </p>
              <div className="dialog-actions">
                <button className="secondary-button" onClick={cancelImport}>
                  Cancel import
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    mixer.stopAll();
                    alarms.stop();
                    setStore({
                      ...incoming,
                      timer: { ...incoming.timer, runningSince: null },
                      notice: "",
                    });
                    toast(
                      "Backup imported. The timer is paused; local media is retained.",
                    );
                    onClose();
                  }}
                >
                  Replace with backup
                </button>
              </div>
            </div>
          </Modal>
        )}
      </Section>
      <Section
        title="A clean page"
        description="Clearing removes all study data, preferences, uploads, custom audio, and legacy or recovery copies from this device."
      >
        {clearing ? (
          <div className="confirmation">
            <p>
              This cannot be undone. Export your JSON and keep copies of your
              original media first.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setClearing(false)}
              >
                Keep my data
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await clearMedia();
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem("stillroom.v2");
                    localStorage.removeItem(LEGACY_KEY);
                    localStorage.removeItem("stillroom.recovery");
                    mixer.close();
                    alarms.close();
                    setStore(initialStore());
                    toast("All local Stillroom data and media cleared.");
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Yes, clear everything
              </button>
            </div>
          </div>
        ) : (
          <button className="danger-button" onClick={() => setClearing(true)}>
            Clear all local data
          </button>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </Section>
    </>
  );
}
