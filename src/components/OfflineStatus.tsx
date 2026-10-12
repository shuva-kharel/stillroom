import { useContext, useEffect, useState } from "react";
import { Modal } from "./UI";
import { StorageStatus } from "./StorageStatus";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function OfflineStatus({ active }: { active: boolean }) {
  const storage = useContext(StorageStatus);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [ready, setReady] = useState(false),
    [help, setHelp] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined;
    let worker: ServiceWorker | null = null;
    const changed = () => {
      if (worker?.state === "installed") {
        if (navigator.serviceWorker.controller)
          setWaiting(registration?.waiting ?? worker);
        else setReady(true);
      }
    };
    const found = () => {
      worker = registration?.installing ?? null;
      worker?.addEventListener("statechange", changed);
    };
    const installable = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", installable);
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      void navigator.serviceWorker
        .register(new URL("sw.js", document.baseURI).href, {
          scope: "./",
          updateViaCache: "none",
        })
        .then((r) => {
          registration = r;
          setWaiting(r.waiting);
          setReady(!!r.active);
          navigator.serviceWorker.controller?.postMessage("CLIENT_READY");
          r.addEventListener("updatefound", found);
          if (r.installing) found();
          void r.update().catch(() => {});
        })
        .catch(() =>
          setError(
            "Offline installation is unavailable in this browser. Your open room still works.",
          ),
        );
    return () => {
      window.removeEventListener("beforeinstallprompt", installable);
      registration?.removeEventListener("updatefound", found);
      worker?.removeEventListener("statechange", changed);
    };
  }, []);
  return (
    <>
      <button className="text-button" onClick={() => setHelp(true)}>
        {ready ? "Available offline" : "Install / offline help"}
      </button>
      {waiting && (
        <div className="update-banner" role="status">
          <span>
            A Stillroom update is ready.{" "}
            {active ? "Your session is active; update when you are ready." : ""}
            {storage.error ? " Saving is unavailable. Export a backup before reloading to update." : ""}
          </span>
          <button
            className="secondary-button"
            disabled={!!storage.error}
            onClick={() => {
              if (
                active &&
                !confirm(
                  "Reload to update? Your timer deadline and saved data will be preserved. Alarms cannot sound during the brief reload.",
                )
              )
                return;
              let reloaded = false;
              const reload = () => {
                if (!reloaded) {
                  reloaded = true;
                  location.reload();
                }
              };
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                reload,
                { once: true },
              );
              waiting.postMessage("ACTIVATE_UPDATE");
            }}
          >
            Apply update
          </button>
        </div>
      )}
      {help && (
        <Modal title="Keep your room nearby" onClose={() => setHelp(false)}>
          <div className="form-stack">
            <p>
              {ready
                ? "The essential app is ready offline."
                : "The production app saves its essential shell after a successful online load."}
            </p>
            {install ? (
              <button
                className="primary-button"
                onClick={async () => {
                  await install.prompt();
                  await install.userChoice;
                  setInstall(null);
                }}
              >
                Install Stillroom
              </button>
            ) : (
              <p>
                Use your browser’s “Install app” or “Add to Home Screen” menu.
                On iPhone or iPad, open Safari’s Share menu, then Add to Home
                Screen. Installation availability depends on your browser.
              </p>
            )}
            <p className="field-hint">
              Timer, tasks, notes, history, reviews, settings, and uploaded
              local media work offline. Spotify requires internet access.
              Closing the app prevents it from actively delivering alarms;
              timestamp recovery works when reopened.
            </p>
            {error && <p role="alert">{error}</p>}
            <p className="field-hint">
              Updates never automatically reload an open session. Export a
              backup before changing domains: each origin has separate browser
              storage.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
