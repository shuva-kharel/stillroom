import { test, expect, type Page } from "@playwright/test";
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(browserErrors.get(page), "No uncaught browser errors").toEqual([]);
});
const state = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("stillroom.v3")!));
async function closeDialog(page: Page) {
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}
async function settings(page: Page, tab: string) {
  if (await page.locator(".companion-sheet").count())
    await page.getByRole("button", { name: "Close study companion" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

test("timer start, pause, refresh, resume, reset, and mode switching", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.clock.install();
  await page.getByRole("button", { name: "Start" }).click();
  await page.clock.fastForward(61000);
  await expect(page.getByRole("timer")).toHaveText("23:59");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.clock.fastForward(600000);
  await expect(page.getByRole("timer")).toHaveText("23:59");
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("23:59");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.clock.fastForward(29000);
  await page.getByRole("button", { name: "Reset timer", exact: false }).click();
  expect((await state(page)).history).toHaveLength(1);
  expect((await state(page)).history[0].duration).toBeGreaterThanOrEqual(90000);
  expect((await state(page)).history[0].duration).toBeLessThan(92000);
  expect((await state(page)).history[0].completed).toBe(false);
  await expect(page.getByRole("timer")).toHaveText("25:00");
  await page.getByRole("tab", { name: "Short break", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await page.getByRole("tab", { name: "Long break", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("15:00");
  await page.getByRole("tab", { name: "Stopwatch", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await page.getByRole("button", { name: "Start" }).click();
  await page.clock.fastForward(10000);
  await expect(page.getByRole("timer")).toHaveText("00:10");
});

test("expired recovery records one completed session without inventing more", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("stillroom.v3")!);
    s.settings.autoStart = true;
    s.timer.runningSince = Date.now() - 86400000;
    localStorage.setItem("stillroom.v3", JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await expect(page.getByRole("status")).toContainText(
    "next session is paused",
  );
  const recovered = await state(page);
  expect(recovered.history).toHaveLength(1);
  expect(recovered.history[0].duration).toBe(1500000);
  expect(recovered.timer.runningSince).toBeNull();
  await page.reload();
  expect((await state(page)).history).toHaveLength(1);
});

test("subjects, task editing, reordering, completion, undo, and notes persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await settings(page, "Subjects");
  await page
    .getByRole("textbox", { name: "New subject name" })
    .fill("Mathematics");
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await closeDialog(page);
  await page.getByLabel("Active study subject").click();
  await page.getByRole("option", { name: "Mathematics", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("What will you work on?")
    .fill("Solve 15 integration questions");
  await page.getByRole("button", { name: "Save task" }).click();
  await page
    .getByRole("button", {
      name: "Focus on Solve 15 integration questions",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Session intention")).toHaveValue(
    "Solve 15 integration questions",
  );
  await page
    .getByRole("button", {
      name: "Edit Solve 15 integration questions",
      exact: true,
    })
    .click();
  await page
    .getByLabel("What will you work on?")
    .fill("Solve 10 integration questions");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("What will you work on?").fill("Read notes");
  await page.getByRole("button", { name: "Save task" }).click();
  await page
    .getByRole("button", { name: "Move Read notes up", exact: true })
    .click();
  expect((await state(page)).tasks[0].title).toBe("Read notes");
  await page
    .getByRole("button", { name: "Delete Read notes", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await state(page)).tasks).toHaveLength(2);
  await page
    .getByRole("button", { name: "Complete Read notes", exact: true })
    .click();
  expect((await state(page)).tasks[0].done).toBe(true);
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await page.getByLabel("Notebook", { exact: true }).click();
  await page.getByRole("option", { name: "Mathematics", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Scratchpad notes" })
    .fill("Integration by parts: remember the boundary term.");
  await page.reload();
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await page.getByLabel("Notebook", { exact: true }).click();
  await page.getByRole("option", { name: "Mathematics", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Scratchpad notes" }),
  ).toHaveValue("Integration by parts: remember the boundary term.");
});

test("all themes persist and mobile layouts do not overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "artifacts/stillroom-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const [theme, id] of [
    ["Paper Desk", "paper"],
    ["Rain Window", "rain"],
    ["Midnight Library", "midnight"],
  ]) {
    await settings(page, "Appearance");
    await page.getByRole("button", { name: new RegExp(theme) }).click();
    await closeDialog(page);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    await page.screenshot({
      path: `artifacts/stillroom-${id}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  if (
    await page
      .getByRole("button", { name: "Hide companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Hide companion panel", exact: true })
      .click();
  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await settings(page, "Appearance");
    expect(
      await page.evaluate(() => {
        const dialog = document.querySelector("dialog")!;
        return dialog.scrollWidth <= dialog.clientWidth;
      }),
    ).toBe(true);
    await closeDialog(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/stillroom-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("keyboard shortcuts, focus view, modal focus, and typing isolation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.locator(".workspace").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByLabel("Session intention").fill("Focus on algebra");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.locator(".workspace").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("f");
  await expect(page.locator(".app")).toHaveClass(/focus-view/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".app")).not.toHaveClass(/focus-view/);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches(":focus-visible"),
    ),
  ).toBe(true);
});

test("brown noise starts, changes volume, and stops using Web Audio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    (window as any).__audio = { starts: 0, stops: 0 };
    AudioBufferSourceNode.prototype.start = function (...args) {
      (window as any).__audio.starts++;
      return original.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      (window as any).__audio.stops++;
      return stop.apply(this, args);
    };
  });
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  expect(await page.evaluate(() => (window as any).__audio.starts)).toBe(0);
  await page
    .getByRole("button", { name: "Play brown noise", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop brown noise", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__audio.starts)).toBe(1);
  await page
    .getByRole("button", { name: "Ambient sound", exact: true })
    .click();
  await page.getByRole("slider", { name: "Brown Noise volume" }).fill("0.63");
  await expect(page.getByText("63%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop all", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__audio.stops))
    .toBe(1);
});

test("JSON export, validated import, clear-data confirmation, and invalid file feedback", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.getByLabel("Session intention").fill("Read chapter 3");
  await settings(page, "Data & Privacy");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^stillroom-.*\.json$/);
  const backup = await state(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("not a supported");
  await page.locator("input[type=file]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByText("Replace this room?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace with backup" }).click();
  await expect(page.getByLabel("Session intention")).toHaveValue(
    "Read chapter 3",
  );
  await settings(page, "Data & Privacy");
  await page
    .getByRole("button", { name: "Clear all local data", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep my data", exact: true }).click();
  expect((await state(page)).timer.intention).toBe("Read chapter 3");
  await page
    .getByRole("button", { name: "Clear all local data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, clear everything", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).timer.intention).toBe("");
});

test("planner, countdown, timer validation, and history removal work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Study planner", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "New checklist item" })
    .fill("Prepare water");
  await page.getByRole("button", { name: "Add checklist item" }).click();
  await page
    .getByRole("button", { name: "Check Prepare water", exact: true })
    .click();
  await page.getByLabel("Exam or milestone").fill("Final exams");
  await page.getByLabel("Date", { exact: true }).fill("2027-06-15");
  expect((await state(page)).plan[0].done).toBe(true);
  expect((await state(page)).exam.date).toBe("2027-06-15");
  await closeDialog(page);
  await settings(page, "Timer & Cycles");
  await page.getByLabel("Focus duration in minutes", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save timer settings" }).click();
  await expect(page.getByRole("alert")).toContainText("Durations must be");
  await page.getByLabel("Focus duration in minutes", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save timer settings" }).click();
  await page
    .getByRole("button", { name: "Apply saved duration to current timer" })
    .click();
  await closeDialog(page);
  await expect(page.getByRole("timer")).toHaveText("01:00");
  await page.clock.install();
  await page.getByRole("button", { name: "Start" }).click();
  await page.clock.fastForward(61000);
  await page
    .getByRole("button", { name: "Study history", exact: true })
    .click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Remove session from/ }).click();
  expect((await state(page)).history).toHaveLength(0);
});

test("a running timer keeps its original timestamp across refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.getByRole("button", { name: "Start" }).click();
  const original = await state(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const recovered = await state(page);
  expect(recovered.timer.id).toBe(original.timer.id);
  expect(recovered.timer.runningSince).toBe(original.timer.runningSince);
  expect(recovered.history).toHaveLength(0);
});

test("corrupted storage recovers safely and keeps the original for recovery", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app")).not.toHaveAttribute("inert", "");
  if (
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Show companion panel", exact: true })
      .click();
  await page.evaluate(() =>
    localStorage.setItem("stillroom.v3", "{broken-json"),
  );
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("25:00");
  await expect(page.getByRole("status")).toContainText(
    "Saved data could not be read",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("stillroom.recovery")),
  ).toBe("{broken-json");
  expect((await state(page)).history).toHaveLength(0);
});
