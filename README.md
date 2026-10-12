# Stillroom

A personal study room built with React, TypeScript, and Vite. No account, backend, credentials, analytics, or cloud storage. Fresh visitors start with an empty room, a quiet charcoal background, and the companion closed.

## Run and deploy

Use Node 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Publish **only `dist/`** to a static HTTPS host, such as GitHub Pages, Netlify, or Cloudflare Pages. Build command: `npm run build`; output directory: `dist`. No environment variables are needed. Relative asset, manifest, and service-worker paths support hosting at `/` or a subdirectory. Serve `sw.js` with `Cache-Control: no-cache`; hashed assets can use long-lived immutable caching. Do not publish the repository, test artifacts, browser profiles, uploads, or backup files as site content.

The production build creates a content-versioned offline shell. After its first successful online load, core tools, bundled fonts, generated sounds, and locally uploaded media work offline. Optional Spotify content requires internet access. Install through the browser's Install/Add to Home Screen action; the app explains the Safari sharing-menu alternative. Updates are announced and applied only through an explicit action. An active timer keeps its saved deadline. Old caches are retained while other open tabs may still need their chunks, then removed when safe.

Changing the hosting domain, protocol, or port creates a different browser-storage origin. **Export a backup before moving domains, then import it on the new site.**

## Using the room

Start immediately with an empty intention, or choose **More → Continue studying** to prepare your last valid subject, unfinished task, mode, duration, and room preset. The preview includes the current saved place. Continue never replaces an active or partially elapsed session; preparing a fresh session leaves it paused until you press Start.

Use **Save place** beside the intention to bookmark a resource, page, question, or timestamp without interrupting the timer. Subject and task are prefilled. **More → Saved places** filters by subject and supports editing, current-resume-point selection, safe HTTP/HTTPS links, and deletion with Undo. Bookmarks whose subjects are deleted appear under Independent study; deleted task links are ignored. There is one selected resume point per subject. These structured bookmarks are separate from accomplishments.

The optional wrap-up now asks **What did you complete?** and **Where will you continue?**, retaining the existing focus rating. Edit the same fields later through **History → Session notes** or the existing Session reflections tool. Next steps appear near the intention when the subject/task matches; expand long notes when needed. Skipping wrap-up never blocks studying or breaks.

Appearance, layout, backgrounds, fonts, and mixer presets remain in customization. The ambience control provides quick mute and master volume (including on mobile). Countdown configuration and lap tools expand only when requested, stay open while in use, and do not automatically close when you start. Focus View still reveals its essential controls on keyboard focus and pointer movement.

Bookmarks and accomplishments are included in personal JSON backups and excluded from shareable room presets. The existing v3 schema gains validated bookmark fields with empty defaults for older data; reflection field names stay unchanged, preserving previous responses. Existing timer state, history, media, and cross-tab ownership remain intact.

- **Timer:** independent countdown with hour/minute/second inputs and presets; optional study accounting, separate from Pomodoro cycles.
- **Clock:** local or selected timezone, 12/24-hour format, optional date and seconds. A live study timer can keep running behind it.
- **Pomodoro:** custom durations, cycle frequency, and separate automatic focus/break transitions, off by default.
- **Stopwatch:** open-ended study with labeled laps that do not duplicate recorded time.
- **Companion:** tasks and subject notebooks, task estimates/reordering/undo, and editable tasks made from selected note text. Notes remain intact. The panel preference persists; on smaller screens it becomes a focus-managed sheet.
- **More:** continue studying with a preview, distraction capture, mini timer, command palette, and contextual study tools.
- **Study tools:** session reflections, user-controlled revision scheduling, timed exam practice with section budgets/checkpoints/pace, and weekly reviews with dated task completions and explicit planning snapshots. Missing past plans and ratings are never invented. Practice contributes actual time, independently of Pomodoro counts; pace does not infer accuracy.
- **Settings:** three themes, six timer renderers, bundled typography, 24 original background presets, local uploads, separate focus/break backgrounds, layouts, mixer/room presets, alarms, optional Spotify embeds, and privacy controls. Appearance changes never reset the timer.
- **History and planning:** actual completed/partial sessions, local-day totals, seven-day chart, subject totals, removable entries, checklist, and exam countdown. Break screens are optional and dismissible.

The main room uses a slim header, centered timer, compact controls, and quiet status footer. Default dark and Paper Desk themes share the same tokens; menus use opaque themed surfaces. The optional bookshelf illustration is labeled **Illustrated Bookshelves** and does not replace saved backgrounds.

| Shortcut | Action |
| --- | --- |
| Space | Start/pause the active timer |
| F | Toggle Focus View |
| Alt + K | Command palette; try `rain`, a subject name, `25 minutes`, or `notes` |
| Escape | Close the current dialog or exit Focus View |
| ? | Keyboard reference |

Global shortcuts leave typing and other open dialogs alone. Dropdowns support arrows, Enter, Escape, and typeahead; the timezone list also has search. Timer digits are not announced every second. Reduced motion is respected. Document Picture-in-Picture uses the same controller as the main window; unsupported browsers receive a compact in-page fallback, not a promised always-on-top window.

## Storage, backups, and privacy

**Your room is saved in this browser. No account needed. Export a backup to move your data to another device.**

- `localStorage`, under **`stillroom.v3`**: preferences, subjects, tasks, notes, history, timer state, room presets, reviews, reflections, practice state, parking items, and weekly plans/reflections.
- IndexedDB **`stillroom.media`**: uploaded images, video, and custom alarm audio. Large media is never stored as base64 in localStorage. Images are resized to at most 1920 pixels; backgrounds are limited to 30 MB, custom audio to 10 MB and 30 seconds. Unsupported/corrupt/missing media uses a fallback or an explanatory error. Object URLs are revoked.
- Existing `stillroom.v1` and `stillroom.v2` data migrates without deleting the old copies. Corrupt data is retained in `stillroom.recovery` where possible. If a recovery copy or a save fails, the app stays usable in memory and shows a persistent, honest warning. Export before closing. Unchanged timer ticks do not rewrite storage.
- JSON personal backups include all structured study data and preferences, **but omit uploaded media**. Re-upload those files on another device. Export creates a paused snapshot without interrupting live work. Validated import **replaces**, not merges, after confirmation; imported timers are paused. Import retains the existing media library.
- Shareable room presets are separate validated JSON files: appearance, display style, background, layout, and mixer levels only. They exclude personal study data, greetings, Spotify links, and uploaded files; upload backgrounds use a solid fallback. Imported presets are previewed before applying.
- Clear all data requires confirmation and clears current, legacy, and recovery storage plus IndexedDB media. It does not unregister the installed offline shell.

Data normally survives reloads and browser restarts when storage is available. Clearing site data removes it; private browsing may remove it when the private session ends. Each device, browser profile, and origin has a separate room. People sharing a browser profile share that saved room. There is **no automatic cross-device sync**, and no personal study data or files are sent to a server or stored in cookies.

Web Locks coordinates one editing/timer owner per origin. Other tabs display the shared state and can explicitly take over. BroadcastChannel and storage events stay within the browser. The mini timer shares this same state; it has no independent engine. HTTPS and Web Locks are required for timer control; unsupported environments show a read-only explanation rather than risking duplicate records.

## Timing and audio limitations

Elapsed time derives from timestamps and uninterrupted work segments, not interval counts. Pauses and breaks do not count. Reset, skip, mode changes, and subject changes record actual partial work. Session IDs make recording idempotent. Local-midnight and local-week boundaries use calendar arithmetic. Recovery resolves an expired session once, caps it at its deadline, and does not fabricate repeated sessions after a long absence. Duration edits apply to future sessions unless explicitly applied to the current timer.

All 12 ambience profiles and six non-silent built-in alarms are original Web Audio synthesis. Fireplace, nature, ocean, rain, café, forest, thunder, keyboard, and fan are **procedural approximations**, not field recordings. Brown/white noise and optional stereo theta tones have distinct profiles. Theta tones carry a headphone note and no learning or health claims. Tracks have individual levels, smooth fades, a separate master/limiter, mute/stop, and cleanup. Settings restore without autoplay. Alarm volume is independent; repetition is bounded. Spotify playback stays inside the official player and is not controlled by the ambience slider.

Closing the app prevents it from actively delivering alarms. Device sleep, browser suspension, autoplay restrictions, and notification permission can also prevent immediate alerts; timestamp recovery works when reopened. Spotify controls its own playback availability, may require sign-in, and cannot expose every embedded-player error to this app. Native installation, fullscreen, codecs, and Document PiP vary by browser.

## Verification and maintenance

JSON import validates the selected file before opening a focused replacement confirmation. Cancel or Escape leaves the room unchanged. Validation errors appear beside the import control. Import restores the timer paused and retains the existing local media library.

```sh
npm test                         # timer, migration, study model, backup, audio lifecycle
npm run build                    # strict TypeScript + production assets + versioned SW
npx playwright install chromium # one-time browser installation
npm run test:e2e                  # UI journeys, storage, tabs, media, responsiveness, axe
node scripts/static-server.mjs  # serve dist at http://127.0.0.1:4173/room/
node scripts/test-offline.mjs    # separate terminal; offline + active-session update
node scripts/audit.mjs           # with Vite running on 5173; screenshots/menu audit
node scripts/styles-check.mjs    # all display styles at maximum size
node scripts/pip-check.mjs       # actual Chromium Document PiP interaction
```

All browser checks use disposable contexts, not the developer's saved room. Screenshots and audit JSON are under ignored `artifacts/audit/`. The offline test temporarily changes the built service worker and restores it in `finally`. Rebuild before deploying. See `AUDIT.md` for the final results and remaining release considerations.

Architecture: `timer.ts` (pure transitions), `study.ts` (study schemas/calendar logic), `persistence.ts`, `coordination.ts`, `media.ts`, `preferences.ts`, `roomPresets.ts`/`portableRoom.ts`, `sound/`, `backgrounds/`, `display/`, and reusable `components/`. `room.css` owns the consolidated main layout; `styles.css` contains shared tokens/components, `studio.css` the customization controls/renderers, and `study.css` contextual tools.

Asset credits are listed in `asset-attributions.json`. No proprietary reference-site artwork, source code, remote fonts, or unlicensed recordings are bundled.
